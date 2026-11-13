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
| `GET /`, `/healthz`, `/healthz/readiness` | Versions-HTML (`window.n8nVersion`) und Health-Antworten |

Ausfälle: `down()` schließt die Verbindung ohne Antwort (Controla: `offline`), `down(BAD_GATEWAY)` bzw.
`down(UNAVAILABLE)` antworten mit 502/503 (Controla: `error`).

Wo der Fake von einem echten n8n abweicht, gilt das echte n8n. Ein Contract-Test gegen `n8nio/n8n` per
Testcontainers ist als Folgeschritt geplant.

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
