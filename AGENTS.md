## Software Factory

Software Factory v0.4.3 is installed through `.github/workflows/factory-manager.yml`,
pinned to commit `aebbcffb00077db9628c4c197e98c17abf198d11`; the independent Codex Harness is pinned to
`8f1732c05c351af32bd25a6306a92f3bb06c1bad` (v0.3.2).
Configuration is `.github/software-factory.yml`: autonomous policy for every
supported action, including scope-expanding follow-ups; OpenAI plans tasks and
Codex implements them using the configured coding model and reasoning effort.
The Actions secret `OPENAI_API_KEY` authenticates both; never put credentials in
Issues, source files or prompts. Resource budgets remain active.

Only Issues explicitly labeled `harness:managed` belong to SF. Those labels are
SF's persisted compatibility vocabulary, independent of the retired harnesses.
The coding worker edits and tests a checkout with read-only GitHub permissions;
SF reauthorizes and publishes a PR in a separate job. A separate mandatory AI
reviewer may conditionally merge exact reviewed commits after fresh CI and GitHub
review/branch gates. Green CI alone never approves a merge. Other same-repository
PRs enter this process only with the `sf:automerge` label; `sf:blocked` stops it.
AI decisions and reasons are recorded on the PR. The coding worker cannot edit
workflow/agent configuration. GitHub may require a maintainer to select
`Approve workflows to run` after a bot updates a PR. SF explains that gate and
never grants or bypasses it. Separately dispatched tests do not replace the
native PR required checks. Product CI and
repository branch rules remain authoritative. Existing pi-spec-harness/Squad
workflows have been retired; their historical Issues and files are not a queue.

Slack notifications use the Actions secret `SLACK_BOT_TOKEN` and channel
`C0CGJKK3EKS` (#ki-notification). Only SF-created Issues and bot-performed
merges of SF PRs notify; human merges are excluded. Notification-only runs do
not invoke a planner or worker. Do not put the Slack token in config or prompts.

## Projektkontext: Editionen (Open Core)

Die CE ist ab der Apache-2.0-Relizenzierung permissiv lizenziert. `LICENSE` und `NOTICE` für Source-/Binary-Distribution beibehalten; vorhandene ältere AGPL-Releases bleiben unter AGPL nutzbar. Lizenzrechte und entgeltliche Feature-/Service-Berechtigungen sind getrennte Konzepte.

Controla wird in zwei Editionen betrieben, die sich ein Frontend teilen:

| Komponente | Ort | Lizenz | Rolle |
|---|---|---|---|
| Community-Backend | `backend/` (dieses Repo) | Apache-2.0, Open Source | Technische Grundlage und Basisfunktionen; bietet die **Erweiterungspunkte**, an denen Premium andockt |
| Frontend | `frontend/` (dieses Repo) | Apache-2.0, Open Source | Eine UI für beide Backends; schaltet Funktionen per **Feature Flag** |
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
