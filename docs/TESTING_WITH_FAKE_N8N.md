# Testen mit Fake-n8n

`backend/src/test/java/de/atstck/controla/testing/FakeN8n.java` simuliert die Teile der n8n-Public-API, die
Controla nutzt. Damit lassen sich Monitoring, Alarme, Export, Import und Instanz-Limits ohne echte
n8n-Container testen, in JUnit und als eigenständiger Prozess.

## Was der Fake abbildet

| Endpunkt | Verhalten |
|---|---|
| `GET /api/v1/users` | 200 mit gültigem `X-N8N-API-KEY`, sonst 401 (Controla: `auth_error`) |
| `GET /api/v1/workflows` | Cursor-Pagination wie n8n: Standard 100, maximal 250 pro Seite, `nextCursor` |
| `POST /api/v1/workflows` | Nimmt nur `name`, `nodes`, `connections`, `settings`, `staticData` an; Felder wie `id`, `active`, `tags` ergeben 400 |
| `GET /api/v1/workflows/{id}` | einzelner Workflow |
| `GET /api/v1/executions` | Filter `status`, `workflowId`, `includeData`, Pagination; neueste zuerst; Fehlertext unter `data.resultData.error.message` |
| `GET /`, `/healthz`, `/healthz/readiness` | Versions-HTML (Base64-Metadatum `n8n:config:sentry`) und Health-Antworten |

Ausfälle: `down()` schließt die Verbindung ohne Antwort (Controla: `offline`), `down(BAD_GATEWAY)` bzw.
`down(UNAVAILABLE)` antworten mit 502/503 (Controla: `error`).

Wo der Fake von einem echten n8n abweicht, gilt das echte n8n. `N8nContractIT` prüft den gemeinsamen
Consumer-Contract gegen echte `n8nio/n8n`-Container; `FakeN8nContractTest` prüft dieselben Assertions
gegen den Fake im normalen Testlauf.

## Contract-Test gegen n8n 2.x und 3.x

Mit laufendem Docker-Daemon vom Repository-Root aus:

```bash
mvn -B -pl backend -Pn8n-contract verify
```

Das Profil `n8n-contract` startet nacheinander die Debian-Images der aktuellen 2.x- und 3.x-Linie.
Die beiden Versionsselektoren stehen ausschließlich in `backend/pom.xml` unter
`n8n.contract.version.2` und `n8n.contract.version.3`. Ein Hauptversionswert (`2` bzw. `3`) wählt den
höchsten stabilen `<major>.<minor>.<patch>-debian`-Tag aus der paginierten Docker-Hub-API. Dadurch
werden weder ungesicherte Major-Alias-Tags noch npm für die Image-Auswahl vorausgesetzt.
Der Docker-Lauf braucht dafür neben den Image-Pulls Zugriff auf `hub.docker.com`.
Für einen reproduzierbaren Lauf lassen sich konkrete Versionen dort eintragen oder per
`-Dn8n.contract.version.2=<version>` und entsprechend `-Dn8n.contract.version.3=3.3.0` überschreiben;
dann entfällt die Tag-Abfrage. Die gewählte genaue Version wird mit `n8n --version` im Container
und mit der Erkennung durch `N8nApiClient` verglichen. Ein Image aus der falschen Hauptversion
lässt den Test fehlschlagen.

Die Vorbereitung erfolgt ausschließlich per HTTP: Owner über `POST /rest/owner/setup`, Abfrage aller
Scopes über `GET /rest/api-keys/scopes`, Schlüssel über `POST /rest/api-keys`, Workflow über die
Public-API und manueller Lauf über `POST /rest/workflows/run`. Der Workflow verbindet einen Manual
Trigger mit Stop And Error. Der Test wartet auf die gespeicherte Fehler-Execution samt Fehlerdaten.
Jeder Container hat eine frische Datenbank; Container und HTTP-Verbindungen werden danach geschlossen.

`N8nApiContract` enthält die gemeinsamen Assertions für Online-Status, fehlenden und falschen API-Key,
exakte Version, rohe und gemappte Workflows einschließlich Ausführungszeitpunkten, abgewiesene
schreibgeschützte Workflow-Felder, Fehler-Executions mit und ohne Daten, exklusiven Zeitfilter sowie
`/healthz` und `/healthz/readiness` mit den echten Diagnose-Checks. Die Produktionsaufrufe verwenden
den echten `N8nApiClient`; zusätzliche HTTP-Assertions prüfen das Datenformat von `includeData`.
Beim Fake werden nur die Execution und die erwartete Version über die Teststeuerung vorbereitet.

`FakeN8nContractTest.contractRejectsADeliberateFakeDeviation` verändert absichtlich die vom Fake
gemeldete Version und erwartet einen Contract-Fehler. Eine Implementierungsabweichung lässt sich
ebenfalls prüfen: im Fake zum Beispiel den Fehlertext nicht mehr unter `data.resultData.error.message`
ausgeben und `mvn -B -pl backend -Dtest=FakeN8nContractTest test` ausführen. Der positive Contract-Test
muss dann fehlschlagen; die absichtliche Änderung anschließend zurücknehmen.

Ohne Profil startet ein lokaler Standardlauf keine n8n-Container. In GitHub Actions aktiviert
`GITHUB_ACTIONS=true` das Profil automatisch: der vorhandene Schritt `mvn -B clean verify` im Job
`test-backend` von `.github/workflows/test.yml` führt damit beide Container-Contracts auf dem
GitHub-hosted Runner aus. Ein fehlender Docker-Daemon führt zum Fehler, nicht zum Überspringen.
Berichte liegen unter `backend/target/failsafe-reports/`, die schnellen Fake-Tests unter
`backend/target/surefire-reports/`. Weitere Prüfschritte stehen in [VERIFICATION.md](VERIFICATION.md).

Die Ermittlung der neuesten n8n-Version für das Produkt (`getLatestN8nVersion`, Issue #117) bleibt
unverändert und wird von diesen Tests nicht aufgerufen.

## In JUnit

```java
try (FakeN8n fake = FakeN8n.start()) {
    FakeN8n.Instance n8n = fake.instance("prod");      // API-Key: fake-key-prod
    String wf = n8n.addWorkflow("Invoice sync");
    n8n.addErrorExecution(wf, "Request failed", Instant.now());
    n8n.down();                                          // Container gestoppt
    // instance.setBaseUrl(n8n.baseUrl()); ...
}
```

`FakeN8nTest` zeigt den Ablauf mit dem echten `N8nApiClient` und `InstanceService`. Der Fake bindet an
`127.0.0.1`; die `InstanceTargetPolicy` muss Loopback für den Test erlauben.

Andere Projekte (z. B. das Premium-Backend) binden den Fake über das Test-Jar ein:

```xml
<dependency>
    <groupId>de.atstck.controla.ce</groupId>
    <artifactId>backend</artifactId>
    <version>${controla.version}</version>
    <type>test-jar</type>
    <scope>test</scope>
</dependency>
```

## Als eigenständiger Prozess

```bash
cd backend
FAKE_N8N_INSTANCES=prod,staging mvn -q test-compile exec:java \
  -Dexec.mainClass=de.atstck.controla.testing.FakeN8n -Dexec.classpathScope=test -Dexec.args="5678"
```

Instanzen liegen dann unter `http://<host>:5678/i/<name>` mit API-Key `fake-key-<name>`. In einem Docker-Netz
setzt `FAKE_N8N_PUBLIC_URL=http://fake-n8n:5678` die Adresse, die `__control` als `baseUrl` meldet. Gesteuert wird
über HTTP:

```bash
curl -X POST localhost:5678/__control/prod/down              # offline (Verbindung geschlossen)
curl -X POST 'localhost:5678/__control/prod/down?mode=503'   # error
curl -X POST localhost:5678/__control/prod/up
curl -X POST localhost:5678/__control/prod/api-key -d '{"apiKey":"neu"}'
curl -X POST localhost:5678/__control/prod/error-execution -d '{"message":"boom"}'
curl -X POST localhost:5678/__control/prod/workflow -d '{"name":"Test"}'
curl localhost:5678/__control/prod/workflows                 # z. B. für Restore-Vergleiche
curl -X POST localhost:5678/__control/prod/reset
```

Läuft Controla in Docker und der Fake im selben Netz, muss die Target-Policy des Backends die Adresse des
Fakes erlauben. Diese Ausnahme gehört nur in Test- und Sandbox-Konfigurationen.
