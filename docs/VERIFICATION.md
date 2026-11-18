# Verifikation

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
