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
mvn -B -pl backend -Pn8n-contract -Dtest=FakeN8nContractTest verify
```

Das Profil `n8n-contract` startet nacheinander zwei fest gepinnte Debian-Images, je eines aus der
2.x- und der 3.x-Linie. Die Versionen stehen ausschließlich als Konstanten `N8N_2_VERSION` und
`N8N_3_VERSION` in `N8nContractIT`; zum Anheben dort die konkrete Version eintragen (z. B. `3.3.0`,
das Image ist dann `n8nio/n8n:3.3.0-debian`). Zur Testlaufzeit wird kein Tag über Docker Hub oder npm
aufgelöst; Docker lädt nur genau diese beiden Images. Die gepinnte Version wird mit `n8n --version` im
Container und mit der Erkennung durch `N8nApiClient` verglichen.

Die Vorbereitung erfolgt ausschließlich per HTTP (HTTP/1.1; der h2c-Upgrade-Versuch des JDK-Clients
bleibt bei n8n sonst unbeantwortet):

1. Der Container gilt erst nach `GET /healthz/readiness` = 200 als gestartet (Startzeit bis 5 Minuten).
   Weil Readiness vor allen REST-Routen melden kann, wird `POST /rest/owner/setup` bis zu 2 Minuten
   wiederholt, solange n8n mit 404/502/503 oder ohne Antwort reagiert.
2. Abfrage aller Scopes über `GET /rest/api-keys/scopes`, API-Key über `POST /rest/api-keys`.
3. Workflow (Webhook-Trigger → Stop And Error) über `POST /api/v1/workflows`, Aktivierung über
   `POST /api/v1/workflows/{id}/activate`, ein Aufruf des Produktions-Webhooks
   `GET /webhook/controla-contract-failure`, danach `POST /api/v1/workflows/{id}/deactivate`.
   Damit hängt die Fehler-Execution nur an der Public API und nicht am privaten Manual-Run-Endpunkt.
4. Der Test wartet bis zu 90 Sekunden auf die gespeicherte Fehler-Execution samt Fehlerdaten.

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

Ohne Profil startet kein Lauf n8n-Container, auch nicht `mvn -B clean verify` im Pflicht-Check
`test-backend`. In CI läuft der Contract-Test im eigenen Job `n8n-contract` von
`.github/workflows/test.yml` auf einem GitHub-hosted Runner mit dem obigen Befehl. Ein fehlender
Docker-Daemon führt dort zum Fehler, nicht zum Überspringen. Berichte liegen unter
`backend/target/failsafe-reports/`, die schnellen Fake-Tests unter `backend/target/surefire-reports/`.
Weitere Prüfschritte stehen in [VERIFICATION.md](VERIFICATION.md).

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
