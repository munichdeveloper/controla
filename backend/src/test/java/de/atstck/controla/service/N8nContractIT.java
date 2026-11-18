package de.atstck.controla.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.utility.DockerImageName;

import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

/** Docker-only contract, selected by Failsafe through the n8n-contract Maven profile. */
class N8nContractIT {

    private static final ObjectMapper JSON = new ObjectMapper();

    @ParameterizedTest(name = "n8n {0}.x satisfies the consumer contract")
    @ValueSource(strings = {"2", "3"})
    void realN8nSatisfiesTheSameContractAsTheFake(String major) throws Exception {
        String selector = Objects.requireNonNull(System.getProperty("n8n.contract.version." + major),
                "Run with -Pn8n-contract verify to configure the n8n images");
        String expectedVersion = resolveVersion(major, selector);
        String image = "n8nio/n8n:" + expectedVersion + "-debian";
        try (GenericContainer<?> n8n = new GenericContainer<>(DockerImageName.parse(image))
                .withExposedPorts(5678)
                .withEnv("N8N_SECURE_COOKIE", "false")
                .withEnv("N8N_DIAGNOSTICS_ENABLED", "false")
                .withEnv("N8N_VERSION_NOTIFICATIONS_ENABLED", "false")
                .withEnv("N8N_PERSONALIZATION_ENABLED", "false")
                .withEnv("N8N_TEMPLATES_ENABLED", "false")
                .withEnv("N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS", "true")
                .waitingFor(Wait.forHttp("/healthz/readiness").forStatusCode(200))
                .withStartupTimeout(Duration.ofMinutes(3))) {
            // No disabledWithoutDocker: an explicitly requested contract run must fail if Docker is absent.
            n8n.start();
            var installed = n8n.execInContainer("n8n", "--version");
            assertThat(installed.getExitCode()).as("read version from the installed n8n binary").isZero();
            String version = installed.getStdout().strip();
            assertThat(version).as("installed binary matches the selected release").isEqualTo(expectedVersion);

            String baseUrl = "http://" + n8n.getHost() + ":" + n8n.getMappedPort(5678);
            N8nApiContract.verify(new Bootstrap(baseUrl).prepare(version));
        }
    }

    private static String resolveVersion(String major, String selector) throws Exception {
        Pattern stable = Pattern.compile(Pattern.quote(major) + "\\.(\\d+)\\.(\\d+)");
        if (!selector.equals(major)) {
            assertThat(stable.matcher(selector).matches()).as("pinned release belongs to major %s", major).isTrue();
            return selector;
        }

        // n8n does not consistently publish major-only Docker aliases. Resolve real Debian tags,
        // rather than inventing a tag or consulting npm (which no longer carries n8n 3 releases).
        HttpClient registry = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
        String next = "https://hub.docker.com/v2/repositories/n8nio/n8n/tags?page_size=100&name=" + major + ".";
        String latest = null;
        Comparator<String> versions = Comparator
                .comparingInt((String version) -> Integer.parseInt(version.split("\\.")[1]))
                .thenComparingInt(version -> Integer.parseInt(version.split("\\.")[2]));
        while (next != null) {
            HttpRequest request = HttpRequest.newBuilder(URI.create(next)).timeout(Duration.ofSeconds(30)).GET().build();
            HttpResponse<String> response = registry.send(request, HttpResponse.BodyHandlers.ofString());
            assertThat(response.statusCode()).as("list published n8n Debian tags").isEqualTo(200);
            JsonNode page = JSON.readTree(response.body());
            for (JsonNode tag : page.path("results")) {
                String name = tag.path("name").asText();
                if (!name.endsWith("-debian")) continue;
                String version = name.substring(0, name.length() - "-debian".length());
                if (stable.matcher(version).matches() && (latest == null || versions.compare(version, latest) > 0)) {
                    latest = version;
                }
            }
            next = page.path("next").asText(null);
        }
        assertThat(latest).as("published stable Debian release for n8n %s.x", major).isNotNull();
        return latest;
    }

    /** Only provisioning uses n8n's private REST API; the contract itself uses the production client. */
    private static final class Bootstrap {
        private final String baseUrl;
        private final HttpClient http;

        private Bootstrap(String baseUrl) {
            this.baseUrl = baseUrl;
            CookieManager cookies = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
            http = HttpClient.newBuilder().cookieHandler(cookies).connectTimeout(Duration.ofSeconds(10)).build();
        }

        private N8nApiContract.Target prepare(String version) throws Exception {
            // Disposable fixture credentials only; neither these nor the generated API key are logged.
            request("POST", "/rest/owner/setup", Map.of(
                    "email", "owner@contract.example", "firstName", "Contract", "lastName", "Owner",
                    "password", "Contract-Fixture-123!"), null);

            JsonNode scopes = request("GET", "/rest/api-keys/scopes", null, null).path("data");
            assertThat(scopes.isArray()).as("owner API-key scopes are available").isTrue();
            assertThat(scopes.isEmpty()).as("all available API-key scopes are requested").isFalse();
            JsonNode key = request("POST", "/rest/api-keys", JSON.createObjectNode()
                    .put("label", "Controla contract").putNull("expiresAt").set("scopes", scopes), null).path("data");
            // n8n releases have used both field names for the newly created, unmasked key.
            String apiKey = key.path("rawApiKey").asText("");
            if (apiKey.isBlank()) apiKey = key.path("apiKey").asText("");
            if (apiKey.isBlank()) throw new IllegalStateException("API-key creation returned no usable key");

            JsonNode workflow = request("POST", "/api/v1/workflows", N8nApiContract.failingWorkflow(), apiKey);
            String workflowId = workflow.path("id").asText();
            assertThat(workflowId).as("created workflow ID").isNotBlank();
            JsonNode run = request("POST", "/rest/workflows/run", Map.of("workflowData", workflow), null).path("data");
            String executionId = run.path("executionId").asText();
            assertThat(executionId).as("manual execution was started").isNotBlank();

            String createdKey = apiKey;
            // Wait for persisted error data, not just an execution ID or an open HTTP port.
            await().alias("failed execution with stored error data").atMost(Duration.ofSeconds(60))
                    .pollInterval(Duration.ofMillis(250)).untilAsserted(() -> {
                        JsonNode execution = findExecution(createdKey, executionId);
                        assertThat(execution.path("status").asText()).isEqualTo("error");
                        assertThat(execution.path("data").path("resultData").path("error").path("message").asText())
                                .isEqualTo(N8nApiContract.ERROR_MESSAGE);
                    });
            JsonNode execution = findExecution(apiKey, executionId);
            Instant startedAt = Instant.parse(execution.path("startedAt").asText());
            return new N8nApiContract.Target(baseUrl, apiKey, version, workflowId, executionId, startedAt);
        }

        private JsonNode findExecution(String apiKey, String id) throws Exception {
            JsonNode data = request("GET", "/api/v1/executions?status=error&includeData=true&limit=10", null, apiKey)
                    .path("data");
            for (JsonNode execution : data) {
                if (id.equals(execution.path("id").asText())) return execution;
            }
            return JSON.createObjectNode();
        }

        private JsonNode request(String method, String path, Object body, String apiKey) throws Exception {
            HttpRequest.Builder request = HttpRequest.newBuilder(URI.create(baseUrl + path))
                    .timeout(Duration.ofSeconds(20)).header("Accept", "application/json");
            if (apiKey != null) request.header("X-N8N-API-KEY", apiKey);
            if (body == null) {
                request.method(method, HttpRequest.BodyPublishers.noBody());
            } else {
                request.header("Content-Type", "application/json")
                        .method(method, HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(body)));
            }
            HttpResponse<String> response = http.send(request.build(), HttpResponse.BodyHandlers.ofString());
            // Do not include response bodies: owner setup and key creation contain authentication material.
            assertThat(response.statusCode()).as("%s %s", method, path).isBetween(200, 299);
            return JSON.readTree(response.body());
        }
    }
}
