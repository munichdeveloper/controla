package de.atstck.controla.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.utility.DockerImageName;

import java.io.IOException;
import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

/** Docker-only contract, selected by Failsafe through the n8n-contract Maven profile. */
class N8nContractIT {

    /**
     * The pinned n8n releases. Raise them here; nothing else selects an image, and no registry lookup
     * happens at test time. Each value must be a concrete release with a published {@code -debian} tag.
     */
    static final String N8N_2_VERSION = "2.0.0";
    static final String N8N_3_VERSION = "3.3.0";
    private static final String IMAGE_SUFFIX = "-debian";

    private static final ObjectMapper JSON = new ObjectMapper();
    /** Covers image start-up including database migrations on a slow runner. */
    private static final Duration STARTUP_TIMEOUT = Duration.ofMinutes(5);
    /** /healthz/readiness can report ready before every REST route is registered. */
    private static final Duration REST_READY_TIMEOUT = Duration.ofMinutes(2);
    private static final Duration EXECUTION_TIMEOUT = Duration.ofSeconds(90);
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(30);

    static Stream<String> pinnedVersions() {
        return Stream.of(N8N_2_VERSION, N8N_3_VERSION);
    }

    @ParameterizedTest(name = "n8n {0} satisfies the consumer contract")
    @MethodSource("pinnedVersions")
    void realN8nSatisfiesTheSameContractAsTheFake(String expectedVersion) throws Exception {
        assertThat(expectedVersion).as("pinned n8n release").matches("\\d+\\.\\d+\\.\\d+");
        assertThat(List.of(N8N_2_VERSION.split("\\.")[0], N8N_3_VERSION.split("\\.")[0]))
                .as("one pinned 2.x and one pinned 3.x release").containsExactlyInAnyOrder("2", "3");

        String image = "n8nio/n8n:" + expectedVersion + IMAGE_SUFFIX;
        try (GenericContainer<?> n8n = new GenericContainer<>(DockerImageName.parse(image))
                .withExposedPorts(5678)
                .withEnv("N8N_SECURE_COOKIE", "false")
                .withEnv("N8N_DIAGNOSTICS_ENABLED", "false")
                .withEnv("N8N_VERSION_NOTIFICATIONS_ENABLED", "false")
                .withEnv("N8N_PERSONALIZATION_ENABLED", "false")
                .withEnv("N8N_TEMPLATES_ENABLED", "false")
                .withEnv("N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS", "true")
                .waitingFor(Wait.forHttp("/healthz/readiness").forStatusCode(200)
                        .withStartupTimeout(STARTUP_TIMEOUT))
                .withStartupTimeout(STARTUP_TIMEOUT)) {
            // No disabledWithoutDocker: an explicitly requested contract run must fail if Docker is absent.
            n8n.start();
            var installed = n8n.execInContainer("n8n", "--version");
            assertThat(installed.getExitCode()).as("read version from the installed n8n binary").isZero();
            String version = installed.getStdout().strip();
            assertThat(version).as("installed binary matches the pinned release").isEqualTo(expectedVersion);

            String baseUrl = "http://" + n8n.getHost() + ":" + n8n.getMappedPort(5678);
            N8nApiContract.verify(new Bootstrap(baseUrl).prepare(version));
        }
    }

    /**
     * Prepares a fresh instance over HTTP. Only owner and API-key setup use n8n's private REST API; the
     * failing execution is produced through the public API (create, activate, deactivate) and the
     * production webhook, which are stable across n8n 2.x and 3.x.
     */
    private static final class Bootstrap {
        private final String baseUrl;
        private final HttpClient http;
        /** n8n binds the session cookie to this header; keep it identical for every private REST call. */
        private final String browserId = UUID.randomUUID().toString();

        private Bootstrap(String baseUrl) {
            this.baseUrl = baseUrl;
            CookieManager cookies = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
            // HTTP/1.1 only: the JDK client otherwise sends an h2c upgrade on plain HTTP, which n8n's
            // WebSocket upgrade handler leaves unanswered, so the request hangs until it times out.
            http = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).cookieHandler(cookies)
                    .connectTimeout(Duration.ofSeconds(10)).build();
        }

        private N8nApiContract.Target prepare(String version) throws Exception {
            setUpOwner();

            JsonNode scopes = json("GET", "/rest/api-keys/scopes", null, null).path("data");
            assertThat(scopes.isArray()).as("owner API-key scopes are available").isTrue();
            assertThat(scopes.isEmpty()).as("all available API-key scopes are requested").isFalse();
            JsonNode key = json("POST", "/rest/api-keys", JSON.createObjectNode()
                    .put("label", "Controla contract").putNull("expiresAt").set("scopes", scopes), null).path("data");
            // n8n releases have used both field names for the newly created, unmasked key.
            String apiKey = key.path("rawApiKey").asText("");
            if (apiKey.isBlank()) apiKey = key.path("apiKey").asText("");
            if (apiKey.isBlank()) throw new IllegalStateException("API-key creation returned no usable key");

            JsonNode workflow = json("POST", "/api/v1/workflows", N8nApiContract.failingWorkflow(), apiKey);
            String workflowId = workflow.path("id").asText();
            assertThat(workflowId).as("created workflow ID").isNotBlank();
            json("POST", "/api/v1/workflows/" + workflowId + "/activate", null, apiKey);

            // Activation registers the production webhook; 404 means it is not registered yet. Stop at the
            // first accepted call so exactly one execution exists.
            await().alias("production webhook accepts the trigger").atMost(Duration.ofSeconds(60))
                    .pollInterval(Duration.ofMillis(500)).ignoreExceptionsInstanceOf(IOException.class)
                    .until(() -> status("GET", "/webhook/" + N8nApiContract.WEBHOOK_PATH, null, null) / 100 == 2);

            String createdKey = apiKey;
            // Wait for persisted error data, not just an accepted webhook call or an open HTTP port.
            JsonNode[] failed = new JsonNode[1];
            await().alias("failed execution with stored error data").atMost(EXECUTION_TIMEOUT)
                    .pollInterval(Duration.ofMillis(500)).untilAsserted(() -> {
                        JsonNode execution = findErrorExecution(createdKey, workflowId);
                        assertThat(execution.path("status").asText()).isEqualTo("error");
                        assertThat(execution.path("data").path("resultData").path("error").path("message").asText())
                                .isEqualTo(N8nApiContract.ERROR_MESSAGE);
                        failed[0] = execution;
                    });
            // The contract expects an inactive workflow, and no further executions afterwards.
            json("POST", "/api/v1/workflows/" + workflowId + "/deactivate", null, apiKey);

            String executionId = failed[0].path("id").asText();
            Instant startedAt = Instant.parse(failed[0].path("startedAt").asText());
            return new N8nApiContract.Target(baseUrl, apiKey, version, workflowId, executionId, startedAt);
        }

        /** Retries until the REST routes are served; readiness alone does not guarantee that. */
        private void setUpOwner() {
            // Disposable fixture credentials only; neither these nor the generated API key are logged.
            Map<String, String> owner = Map.of("email", "owner@contract.example", "firstName", "Contract",
                    "lastName", "Owner", "password", "Contract-Fixture-123!");
            int[] last = {0};
            await().alias("n8n REST API accepts the owner setup").atMost(REST_READY_TIMEOUT)
                    .pollInterval(Duration.ofSeconds(1)).ignoreExceptionsInstanceOf(IOException.class)
                    .until(() -> {
                        last[0] = status("POST", "/rest/owner/setup", owner, null);
                        if (last[0] / 100 == 2) return true;
                        // Starting up: route missing or the server answers with a temporary error.
                        if (last[0] == 404 || last[0] == 502 || last[0] == 503) return false;
                        throw new IllegalStateException("POST /rest/owner/setup answered " + last[0]);
                    });
        }

        private JsonNode findErrorExecution(String apiKey, String workflowId) throws Exception {
            JsonNode data = json("GET", "/api/v1/executions?status=error&includeData=true&limit=10&workflowId="
                    + workflowId, null, apiKey).path("data");
            return data.isArray() && !data.isEmpty() ? data.get(0) : JSON.createObjectNode();
        }

        private JsonNode json(String method, String path, Object body, String apiKey) throws Exception {
            HttpResponse<String> response = send(method, path, body, apiKey);
            // Do not include response bodies: owner setup and key creation contain authentication material.
            assertThat(response.statusCode()).as("%s %s", method, path).isBetween(200, 299);
            String text = response.body();
            return text == null || text.isBlank() ? JSON.createObjectNode() : JSON.readTree(text);
        }

        private int status(String method, String path, Object body, String apiKey) throws Exception {
            return send(method, path, body, apiKey).statusCode();
        }

        private HttpResponse<String> send(String method, String path, Object body, String apiKey) throws Exception {
            HttpRequest.Builder request = HttpRequest.newBuilder(URI.create(baseUrl + path))
                    .timeout(REQUEST_TIMEOUT).header("Accept", "application/json").header("browser-id", browserId);
            if (apiKey != null) request.header("X-N8N-API-KEY", apiKey);
            if (body == null) {
                request.method(method, HttpRequest.BodyPublishers.noBody());
            } else {
                request.header("Content-Type", "application/json")
                        .method(method, HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(body)));
            }
            return http.send(request.build(), HttpResponse.BodyHandlers.ofString());
        }
    }
}
