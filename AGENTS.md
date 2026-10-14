<!-- BEGIN pi-spec-harness managed context v1 -->
## Harness-Kontext (verwaltet von pi-spec-harness)

Dieses Repository (munichdeveloper/controla) wird teilweise von [pi-spec-harness](https://github.com/munichdeveloper/pi-spec-harness)
orchestriert. Der Harness ändert keinen Produktcode selbst; er
kontrolliert und beobachtet, wie ein Agent zwischen Spec, Issue, PR und
Merge bewegt wird.

**Bevor du an einem Issue eigenständig arbeitest:** Prüfe zuerst, ob
bereits ein offenes Tracking-Issue (Titel `[Harness Run] <run-id>`,
Label `harness:run`) existiert, das auf dieses Issue verweist. Falls
ja, enthält dessen Body den kanonischen, aktuellen Fortschrittsstand
(Phase, offene Gates, bisherige Entscheidungen) — lies ihn, bevor du
von vorne beginnst oder rätst, was bereits erledigt ist.

**Label-Vokabular:**

| Label | Bedeutung |
|---|---|
| `ai:allowed` | Issue darf von einem Agenten selbstständig bearbeitet werden |
| `status:ready` | Issue ist fachlich/technisch bereit zur Bearbeitung |
| `status:needs-human` | Ein Mensch muss entscheiden, bevor es weitergeht |
| `harness:run` | Markiert das persistente Tracking-Issue eines Runs |
| `harness:implementation` | Markiert ein vom Harness erzeugtes Implementierungs-Issue |
| `harness:gate-approved` / `harness:gate-rejected` | Menschliche Entscheidung auf einem offenen Gate |

Ausführliche Dokumentation zum Protokoll: `docs/human-gates.md` und
`docs/event-driven-workflow.md` im Harness-Repository.

Dieser Block wird von `harness init --install-agents-context`
verwaltet. Änderungen innerhalb der Marker werden bei der nächsten
Installation überschrieben; projektspezifische Regeln gehören
außerhalb dieses Blocks.
<!-- END pi-spec-harness managed context v1 -->

## Projektkontext: Editionen (Open Core)

Controla wird in zwei Editionen betrieben, die sich ein Frontend teilen:

| Komponente | Ort | Lizenz | Rolle |
|---|---|---|---|
| Community-Backend | `backend/` (dieses Repo) | AGPLv3, Open Source | Technische Grundlage und Basisfunktionen; bietet die **Erweiterungspunkte**, an denen Premium andockt |
| Frontend | `frontend/` (dieses Repo) | AGPLv3, Open Source | Eine UI für beide Backends; schaltet Funktionen per **Feature Flag** |
| Premium-Backend | separates, privates Repo | Closed Source, nur als SaaS betrieben | Bindet das Community-Backend als Maven-Bibliothek ein und ergänzt Paid- und Enterprise-Features |
| n8n-companion | separates Repo | – | Agent neben n8n auf dem Docker-Host; wird vom Premium-Backend angesprochen |

### Wohin gehört eine Funktion?

- **Community-Backend:** alles, was jede Installation als Grundlage braucht, plus der Erweiterungspunkt (Interface, Default-Implementierung, DTO), über den Premium die Funktion erweitert.
- **Premium-Backend:** Paid Features, insbesondere Enterprise (Mandanten, Billing/SSO, Backups, Incidents/Uptime, Companion-Steuerung). In diesem Repo liegt davon nur der Erweiterungspunkt und die UI hinter einem Feature Flag.

### Erweiterungspunkte

- Interface + CE-Default-Bean mit `@ConditionalOnMissingBean`; Premium liefert eine eigene, per Component-Scan gefundene Bean (Beispiele: `license/LicenseConfiguration`, `security/TargetPolicyConfiguration`).
- Beitrags-SPIs, deren Beans gesammelt werden: `license/FeatureProvider` (Feature-Keys), `diagnostics/DiagnosticCheck` und `diagnostics/DiagnosticConclusionProvider` (Diagnosebericht).
- Interface + CE-Default; Premium übersteuert mit `@Primary` (Beispiel: `alerts/InstanceAlertHandler`).
- Ersetzen am selben Pfad: Premium bindet ein CE-Paket nicht ein und liefert einen eigenen Controller unter demselben Pfad (Beispiel: `backups/BackupSettingsController` → `/api/backups/settings`). Das Frontend nutzt dann in beiden Editionen denselben Aufruf.
- Neue Premium-Endpunkte liegen unter `/api/premium/**`; einige ältere Premium-Endpunkte liegen außerhalb dieses Präfixes.

Öffentliche Typen, die Premium nutzt (Interfaces, Entities, Repositories, DTOs, `security/TenantContext`), sind **API**: Ändere sie abwärtskompatibel. Ein Breaking Change braucht eine neue CE-Version und ein abgestimmtes Premium-Update.

### Kopplung an Premium (Gotchas)

- Premium bindet eine **feste CE-Version** aus GitHub Packages (`.github/workflows/maven-publish.yml`). CE-Änderungen kommen dort erst nach Release und Versions-Bump an.
- Premium scannt CE-Pakete über eine **explizite Paketliste** (`@ComponentScan`, `@EnableJpaRepositories`, `@EntityScan`). Ein neues Paket unter `de.atstck.controla.*` bleibt in Premium unsichtbar, bis es dort ergänzt wird – plane das Premium-Update mit ein.
- Flyway: CE-Migrationen nutzen `V1`–`V99`, Premium beginnt bei `V100`.
- Aufrufe an vom Kunden eingetragene URLs (n8n-Basis-URL, Companion) laufen über `service/InstanceHttpClient`; dort greift die `InstanceTargetPolicy` auf die aufgelöste IP, auch bei Redirects; Redirects folgt der Client nur auf denselben Host, damit Credential-Header nicht weitergereicht werden. Interne Dienste nutzen das reguläre `restTemplate`.

### Feature Flags: Vertrag zwischen Frontend und Backend

Das Frontend erkennt über `GET /api/license` (`edition`, `maxInstances`, `features`), welches Backend angeschlossen ist; ausgewertet in `frontend/src/lib/license/LicenseContext.tsx` (`useLicense()`, `isFeatureEnabled(key)`).

**Grundregel:** Ein UI-Element, das einen Endpunkt aufruft, wird nur gerendert, wenn das angeschlossene Backend diesen Endpunkt garantiert anbietet.

- Eine neue Funktion mit eigener UI bekommt einen eigenen Feature-Key (`bereich.funktion`, z. B. `diagnostics.report`).
- Den Key meldet der `FeatureProvider` des Moduls, das den Endpunkt enthält (CE: `license/CommunityFeatures`); der Endpunkt trägt `@RequiresFeature("<key>")`. `FeatureRegistry` liefert ihn über `GET /api/license` aus – `COMMUNITY`-Keys immer `true`, `PREMIUM`-Keys laut Lizenz. Ein fehlender Key gilt im Frontend als `false` (ADR-002).
- `license/FeatureContractTest` prüft, dass jeder Key einen Endpunkt hat und jeder Endpunkt-Key gemeldet wird; Keys ohne eigenen Endpunkt markierst du `behaviorOnly`.
- Gate im Frontend über `isFeatureEnabled(key)` mit Konstanten aus `frontend/src/lib/license/features.ts`. `isPremium` (Vergleich des Editionsnamens) ist Altbestand; neue Gates nutzen Keys.
- Das gilt auch für CE-Funktionen: Das SaaS-Frontend kann neuer sein als das Premium-Backend, das eine ältere CE-Version einbindet.
- Hängt eine Funktion zusätzlich von externem Zustand ab (z. B. Companion eingerichtet, erreichbar, ausreichend neu), zeigt die UI an dieser Stelle einen erklärenden Hinweis statt des Bedienelements.

**Fertig ist eine Änderung mit UI erst, wenn** für jedes neue Bedienelement benannt ist, welcher Feature-Key es schaltet und welches Backend (CE oder Premium, ab welcher Version) den aufgerufenen Endpunkt liefert.
