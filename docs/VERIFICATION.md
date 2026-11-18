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

## Echter n8n-Contract (Testcontainers)

Die folgenden Befehle werden vom Repository-Root ausgeführt. Voraussetzung sind Java 17, Maven
und für die Integrationstests ein laufender Docker-Daemon. Beim ersten Lauf werden Maven-Abhängigkeiten
und Container-Images geladen.

| Prüfung | Befehl | Nachweis |
|---|---|---|
| Backend einschließlich PostgreSQL-Integrationstests | `mvn -B -pl backend verify` | `backend/target/surefire-reports/` |
| Schneller Fake-n8n-Contract einschließlich absichtlicher Abweichung | `mvn -B -pl backend -Dtest=FakeN8nContractTest test` | `backend/target/surefire-reports/` |
| Echter n8n-Contract gegen 2.x und 3.x (Debian-Images) | `mvn -B -pl backend -Pn8n-contract verify` | `backend/target/failsafe-reports/TEST-de.atstck.controla.service.N8nContractIT.xml` |

`FakeN8nContractTest` und `N8nContractIT` verwenden dieselben Assertions aus `N8nApiContract` und den
echten `N8nApiClient`. Geprüft werden Status und Authentifizierung, genaue installierte Version,
Workflows, Fehler-Executions mit und ohne Daten einschließlich Zeitfilter sowie Health und Readiness.
Der echte Test richtet Owner und API-Key mit allen verfügbaren Scopes per API ein und führt einen
absichtlich fehlschlagenden Workflow aus. Der negative Fake-Test stellt sicher, dass eine abweichende
Versionsantwort den Contract verletzt.

Die zwei Versionsselektoren werden im Maven-Profil `n8n-contract` in `backend/pom.xml` gepflegt und
können für einen konkreten Release-Lauf über `-Dn8n.contract.version.2=<version>` und
`-Dn8n.contract.version.3=3.3.0` überschrieben werden. Standardmäßig werden die höchsten stabilen
Debian-Tags der Hauptversionen 2 und 3 über die paginierte Docker-Hub-API ausgewählt; dies benötigt
Netzwerkzugriff auf `hub.docker.com`. Konkrete Versionen überspringen diese Abfrage.
Ein falscher Major oder fehlender Docker-Daemon führt zum Fehler. Lokal sind die n8n-Container
nur bei aktiviertem Profil Teil von `verify`.

In `.github/workflows/test.yml` führt der vorhandene GitHub-hosted Job `test-backend` bereits
`mvn -B clean verify` aus. Das Profil aktiviert sich dort durch `GITHUB_ACTIONS=true` automatisch und
Failsafe lässt den Build bei Contract-Fehlern scheitern. Die Workflow-Datei muss dafür nicht geändert
werden. Einzelheiten und eine Anleitung für eine manuelle Mutation des Fakes stehen in
[TESTING_WITH_FAKE_N8N.md](TESTING_WITH_FAKE_N8N.md).

Die Produktlogik zur neuesten n8n-Version (Issue #117) gehört nicht zu dieser Änderung.

## Folgeschritte

- Die Contract-Tests gegen echte `n8nio/n8n`-Instanzen stehen im Abschnitt
  [Echter n8n-Contract](#echter-n8n-contract-testcontainers). Sobald sie in CI
  stabil laufen, bei **N** als Pflicht ergänzen.
- Ein zusammenfassender Verifikationsbefehl für Agents ist ein separates Issue;
  bis dahin gelten die einzelnen Befehle dieses Katalogs.
