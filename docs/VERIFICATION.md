# Verifikationskatalog

Dieser Katalog legt die Pflichtprüfungen für Änderungen an Controla fest, auch
für Coding-Agents. Treffen mehrere Änderungsarten zu, gilt die Vereinigung ihrer
Prüfungen. Ein vollständiger Lauf kann mehrere Pflichten abdecken; derselbe Test
muss für denselben Stand nicht mehrfach laufen. Alle Nachweise müssen sich auf
den im PR geprüften Commit beziehen.

## Art der Änderung → Pflichtprüfungen → Nachweis im PR

Die Kürzel verweisen auf die genauen Befehle und Bestehenskriterien weiter unten.

| Art der Änderung | Pflichtprüfungen | Nachweis im PR |
| --- | --- | --- |
| Backend-API und Services | **V**: vollständiger Maven-Build einschließlich Backend-Tests. Geändertes Verhalten mit passenden Controller-/Service-Regressionstests abdecken; bei geändertem Frontend-Vertrag zusätzlich **F**. | Befehle und Ergebnisse, Surefire-Zusammenfassung, betroffene Endpunkte und getestete Erfolgs-/Fehlerfälle; Auswirkungen auf öffentliche CE-/Premium-Erweiterungspunkte. |
| n8n-Anbindung (`N8nApiClient`, Versionserkennung, Executions) | **V** und **N**: Fake-n8n-, HTTP- und Execution-Tests. Neue oder geänderte Antworten im Fake bzw. in gezielten Regressionstests abbilden; Anleitung: [Testen mit Fake-n8n](TESTING_WITH_FAKE_N8N.md). | Testklassen und Ergebnisse; geprüfte n8n-Version/Antwortformate, Versionsauswertung, Authentifizierungs- und Ausfallverhalten sowie Execution-Filter/Pagination, soweit betroffen. Fake-Abdeckung ausdrücklich benennen; Stand der echten n8n-Contract-Tests unter [Folgeschritte](#folgeschritte). |
| Frontend-Seite oder Komponente | **F**: Lint, Unit-Tests, Produktionsbuild, Typecheck und Chromium-E2E. Geänderte Bedienabläufe und Fehlerzustände prüfen; bei geänderten Feature-Gates zusätzlich **K**. | Ergebnisse aller Befehle, betroffene Routen/Bedienabläufe und Screenshots der geänderten UI (Desktop und Mobilansicht, betroffene helle/dunkle Darstellung). Für neue Bedienelemente Feature-Key und lieferndes Backend (CE/Premium, Mindestversion) nennen. |
| Lizenz, Editionen und Premium | **V** und **K**: insbesondere `FeatureContractTest`. Bei Frontend-/Gate-Änderungen zusätzlich **F**; bei Lizenztext-/Distributionsänderungen zusätzlich **C** und die [Lizenzhinweise](LICENSING.md) prüfen. | Contract-Test-Ergebnis, geänderte Keys und Editionen, Verhalten bei fehlendem/ausgeschaltetem Key und Berechtigungsgrenzen. Bei Distribution Nachweis für `LICENSE`/`NOTICE`; bei Premium-Kopplung benötigte CE-Version und ggf. separaten Premium-Testnachweis verlinken. |
| Datenbank-Migration | **V** und **D** mit echtem PostgreSQL über Testcontainers; migrationsspezifische Tests für Neuinstallation und Upgrade mit Bestandsdaten ergänzen. | Migrationsdateien/-versionen, Ausgangsschema und Testdaten, Ergebnis der Neuinstallation und des Upgrades einschließlich Datenerhalt; Wiederherstellung/Rollback und Kompatibilität zur bisherigen Anwendung beschreiben. |
| Abhängigkeits-Update | **V**; bei npm-/Frontend- oder gemeinsamem Toolchain-Update zusätzlich **F**; bei Änderungen am ausgelieferten Laufzeit-/Container-Stack zusätzlich **C**. POM-/Lockfile-Diff und transitive Änderungen prüfen; [Lizenzinventar](LICENSE_INVENTORY.md) berücksichtigen. | Alte/neue Versionen, direkte und relevante transitive Änderungen, Ergebnisse der betroffenen Tests/Builds, Lizenz-/Sicherheitshinweise und bei Laufzeitänderungen Docker-Smoke-Ergebnis. |
| Doku-only | **O**: Whitespace prüfen sowie relative Links, Dateipfade und dokumentierte Befehle mit den aktuellen Quellen abgleichen. Sobald sich ausführbarer Code, Abhängigkeiten oder Konfiguration ändern, gelten zusätzlich deren Zeilen. | Ergebnis von `git diff --check`, geprüfte Links/Pfade und Befehlsquellen; begründen, warum keine Laufzeitprüfung erforderlich ist. |

## Pflicht für UI- und API-Änderungen: `npm run verify`

Jede Änderung an Frontend-Seiten/Komponenten oder an Backend-API und Services
(auch von Coding-Agents) muss zusätzlich zu den Prüfungen der Tabelle diesen
Befehl ausführen und den Bericht prüfen. Er ersetzt **V** und **F** nicht.

```sh
cd frontend
npm ci
npm run verify
```

Der Befehl baut Backend-JAR (`mvn`) und Frontend, startet das Backend mit einer
eigenen PostgreSQL-Test-Datenbank (lokale `initdb`/`pg_ctl`-Binaries, kein
Docker), `FakeN8n` als eigenen Prozess (Instanzen: online, offline,
Auth-Fehler, mit Fehler-Executions) und das Frontend. Danach läuft ein
Playwright-Rundgang (Login, Instanzübersicht, Instanzdetail mit Fehlern,
Alerts, Export/Import, Einstellungen) in Desktop- und 390-px-Ansicht. Der
echte n8n bleibt den Contract-Tests vorbehalten.

Ergebnis: `target/verify-report/report.md` (bestanden/fehlgeschlagen je Schritt),
Screenshots (`*.png`) und Prozess-Logs (`*.log`) im selben Ordner. Bestanden:
Exitcode 0. Jede Konsolenfehlermeldung, jede JavaScript-Ausnahme und jede
5xx-Antwort lässt den betroffenen Schritt mit Meldung (Methode und Pfad)
fehlschlagen. Der Import-Knopf ist Premium; in der CE wird er nicht geprüft.
Chromium muss installiert sein (`npx playwright install --with-deps chromium`).

Optionale Umgebungsvariablen: `VERIFY_SKIP_BUILD=1` (vorhandene Builds nutzen),
`VERIFY_DATABASE_URL`/`VERIFY_DATABASE_USER`/`VERIFY_DATABASE_PASSWORD` (vorhandene
Test-Datenbank), `VERIFY_PG_BIN` (PostgreSQL-Binaries), `VERIFY_BACKEND_PORT`
(Standard 8081). Selbsttest der Fehlermeldung: `VERIFY_BREAK_API=/api/instances`
lässt diesen Endpunkt mit 500 antworten, der Lauf muss dann fehlschlagen.
Ports 3027 und 8081 müssen frei sein.

## Voraussetzungen und Ausführungsort

- Root-Befehle laufen im Repository-Root, Frontend-Befehle in `frontend/`.
- Java 17, Maven (3.9 empfohlen), Node.js 24.22.0 und npm 11.9.0 verwenden;
  maßgeblich sind die POMs, `frontend/.nvmrc` und `frontend/package.json`.
  Der Maven-Reaktor installiert seine Node-/npm-Version selbst.
- PostgreSQL-Testcontainers und Docker-Prüfungen brauchen einen laufenden
  Docker-Daemon und das Image `postgres:16-alpine`. Browserprüfungen brauchen
  Chromium einschließlich Systembibliotheken und den freien Port 3027.
- Abhängigkeiten, Images und Browser müssen bereits vorhanden sein oder in
  einer Umgebung mit Netzwerkzugriff installiert werden können. In einem
  Offline-Worker, dessen Ausführungskontext Testläufe untersagt, bleiben diese
  Prüfungen beim nachgelagerten Validierungsjob. Im Nachweis bis zu dessen
  Ergebnis ausdrücklich „ausstehend“ vermerken.

### V – Vollständiger Build mit Backend-Tests

Im Repository-Root:

```sh
mvn -B clean verify
```

Bestanden: `BUILD SUCCESS`, keine Testfehler und alle für die Änderung
erforderlichen Tests tatsächlich ausgeführt. Berichte liegen unter
`backend/target/surefire-reports/`, der Coverage-Bericht unter
`backend/target/site/jacoco/`. Dieser Befehl baut auch das Frontend, führt aber
dessen Lint-, Unit-, Typecheck- und Browserbefehle aus **F** nicht aus.

### F – Frontend einschließlich Browser

In `frontend/`, in dieser Reihenfolge:

```sh
npm ci
npm run lint
npm test
npm run build
npm run typecheck
npx playwright install --with-deps chromium
npm run test:e2e
```

`npm ci` und die Browserinstallation bereiten die Umgebung vor. Der Build muss
vor dem Typecheck und E2E-Lauf erfolgen: Er erzeugt die Next.js-Routentypen und
den Standalone-Server. Playwright startet diesen Server selbst.

Bestanden: jeder Befehl mit Exitcode 0, keine Lint-/Typfehler, alle erforderlichen
Vitest- und Playwright-Fälle bestanden. Die E2E-Tests unter `frontend/e2e/`
simulieren API-/Editionsverträge; sie belegen keine Ausführung gegen ein echtes
Premium-Backend oder n8n. Fehlerartefakte liegen unter `frontend/test-results/`.
Playwright speichert standardmäßig nur bei Fehlern Screenshots; die im PR
geforderten Screenshots erfolgreicher UI-Zustände zusätzlich aufnehmen.

### N – n8n-Anbindung mit Fake und HTTP-Tests

Im Repository-Root:

```sh
mvn -B -pl backend -Dtest=FakeN8nTest,N8nApiClientSummariesTest,InstanceHttpClientTest,N8nHttpChecksTest,N8nExecutionErrorsCheckTest test
```

Bestanden: alle genannten Klassen ausgeführt, keine Fehler. `FakeN8nTest` treibt
den echten `N8nApiClient` und `InstanceService` gegen einen lokalen HTTP-Fake,
einschließlich Version, Zustandswechseln, ungültigem API-Key, Workflow-Export und
fehlerhaften Executions. Der Fake startet und endet im Test; ein eigenständiger
Fake-Prozess ist für diesen Befehl nicht nötig. Die Loopback-Freigabe bleibt auf
die Testkonfiguration begrenzt. Weitere Szenarien und der optionale manuelle
Prozess sind in [TESTING_WITH_FAKE_N8N.md](TESTING_WITH_FAKE_N8N.md) beschrieben.

### K – Feature-/Editionsvertrag

Im Repository-Root:

```sh
mvn -B -pl backend -Dtest=FeatureContractTest,FeatureRegistryTest,FeatureGuardInterceptorTest,LicenseControllerTest,LicenseConfigurationTest test
```

Bestanden: alle genannten Klassen ausgeführt, keine Fehler. `FeatureContractTest`
prüft die Zuordnung zwischen gemeldeten Keys und mit `@RequiresFeature`
geschützten Endpunkten einschließlich der Ausnahme `behaviorOnly`.
Registry-, Guard- und Lizenztests ergänzen diesen Strukturvertrag. UI-Gates
müssen fehlende Keys als deaktiviert behandeln; maßgeblich ist
[ADR-002](04_decisions/ADR-002-feature-registry.md). Tests des privaten
Premium-Backends laufen in dessen Repository; einen ausstehenden Nachweis im PR
benennen und keinen lokalen Premium-Prüfbefehl erfinden.

### D – PostgreSQL und Migrationen

Im Repository-Root:

```sh
mvn -B -pl backend -Dtest=InstanceCreationConcurrencyTest test
```

Bestanden: PostgreSQL-Testcontainer gestartet, Flyway-Migrationen erfolgreich
angewendet und alle Testfälle bestanden. Der bestehende Test migriert eine leere
Datenbank und prüft Persistenz, Tenant-Trennung und konkurrierende Instanzanlage.
Er belegt allein kein Upgrade mit Bestandsdaten. Bei einer neuen Migration muss
der Änderungs-PR zusätzliche automatisierte Fälle für das vorherige Schema mit
repräsentativen Daten und den erwarteten Zielzustand enthalten; diese laufen
über **V** mit. CE-Migrationen verwenden `V1`–`V99`, Premium beginnt bei `V100`.

### C – Ausgeliefertes Docker-Image

Im Repository-Root, mit Python 3 und Docker:

```sh
docker build --tag controla:ci .
docker run --rm --entrypoint /bin/sh controla:ci -ec 'test -s /app/LICENSE && test -s /app/NOTICE'
python3 .github/scripts/smoke-docker.py controla:ci
```

Bestanden: alle Befehle mit Exitcode 0; Lizenzdateien im Image vorhanden und
Docker-Smoke erfolgreich (PostgreSQL, Login, geschützte API, Next.js-Rewrite,
statische Assets, Healthcheck und Prozessüberwachung). Bei Lizenz-/Paketänderungen
außerdem die von **V** erzeugten Backend-JARs auf `LICENSE` und `NOTICE` prüfen;
die vorhandene [Test-CI](../.github/workflows/test.yml) enthält diese JAR-Prüfung.

### O – Dokumentation

Im Repository-Root:

```sh
git diff --check
```

Bestanden: Exitcode 0 und alle geänderten Links/Pfade aufgelöst. Dokumentierte
Befehle anhand von `pom.xml`, `backend/pom.xml`, `frontend/pom.xml`,
`frontend/package.json`, `frontend/playwright.config.mjs` und vorhandenen
Testklassen/Skripten prüfen. Es gibt derzeit keinen eigenen Markdown-Testbefehl.

## Nachweis im PR

Für jede Pflichtprüfung festhalten:

- geprüften Commit, Änderungsarten und ausgewählte Prüfungen aus der Tabelle;
- exakten Befehl und Arbeitsverzeichnis, Ergebnis/Exitcode und bei Tests Anzahl
  bestanden/fehlgeschlagen/übersprungen; CI-Lauf bzw. Berichte/Artefakte verlinken;
- neue oder angepasste Regressionstests und welche Anforderung sie belegen;
- bei UI-Änderungen Screenshots mit Route, Viewport, Edition und sichtbarem
  Zustand; bei Feature-Gates auch den deaktivierten/fehlenden Key zeigen;
- nicht ausgeführte oder übersprungene Prüfungen mit konkretem Grund und
  zuständigem Validierungsjob als „ausstehend“ kennzeichnen.

Ein Build ohne Testausführung, ein übersprungener Pflichtfall oder ein noch
laufender Validierungsjob ist kein bestandener Testnachweis. Bei Fehlern den
fehlgeschlagenen Befehl und die Ursache dokumentieren und nach der Korrektur die
betroffenen Prüfungen für den neuen Stand wiederholen. Logs und Screenshots
dürfen keine Zugangsdaten oder Kundendaten enthalten.

## Folgeschritte

- Contract-Tests gegen echte `n8nio/n8n`-Instanzen per Testcontainers sind laut
  [Fake-n8n-Anleitung](TESTING_WITH_FAKE_N8N.md) ein separates Folge-Issue. Im
  aktuellen Checkout gibt es dafür noch keinen ausführbaren Prüfbefehl. Sobald
  sie implementiert sind, den realen Befehl, die geprüften n8n-Versionen und die
  Bestehenskriterien hier bei **N** ergänzen und verbindlich machen.
- Ein CI-Job für `npm run verify` und der Verweis in `AGENTS.md` folgen separat.
