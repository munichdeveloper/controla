package de.atstck.controla.service;

import de.atstck.controla.diagnostics.DiagnosticContext;
import de.atstck.controla.diagnostics.DiagnosticStatus;
import de.atstck.controla.diagnostics.HttpProbe;
import de.atstck.controla.diagnostics.checks.N8nHealthCheck;
import de.atstck.controla.diagnostics.checks.N8nReadinessCheck;
import de.atstck.controla.dto.EventDto;
import de.atstck.controla.instance.Instance;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.io.IOException;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assertions.assertAll;

/** The same consumer contract is applied to real n8n and FakeN8n, without backend-specific assertions. */
final class N8nApiContract {

    static final String WORKFLOW_NAME = "Controla contract failure";
    static final String ERROR_MESSAGE = "Controla contract intentional error";

    record Target(String baseUrl, String apiKey, String version, String workflowId, String executionId,
                  Instant startedAt) {
    }

    private N8nApiContract() {
    }

    static Map<String, Object> failingWorkflow() {
        return Map.of(
                "name", WORKFLOW_NAME,
                "nodes", List.of(
                        Map.of("id", "start", "name", "Start", "type", "n8n-nodes-base.manualTrigger",
                                "typeVersion", 1, "position", List.of(0, 0), "parameters", Map.of()),
                        Map.of("id", "fail", "name", "Fail", "type", "n8n-nodes-base.stopAndError",
                                "typeVersion", 1, "position", List.of(200, 0),
                                "parameters", Map.of("errorType", "errorMessage", "errorMessage", ERROR_MESSAGE))),
                "connections", Map.of("Start", Map.of("main",
                        List.of(List.of(Map.of("node", "Fail", "type", "main", "index", 0))))),
                "settings", Map.of("executionOrder", "v1", "saveManualExecutions", true,
                        "saveDataErrorExecution", "all"));
    }

    static void verify(Target target) throws IOException {
        InstanceHttpClient http = new InstanceHttpClient(address -> true);
        try {
            N8nApiClient client = new N8nApiClient(http);
            RestTemplate rest = http.restTemplate();
            HttpHeaders headers = new HttpHeaders();
            headers.set("X-N8N-API-KEY", target.apiKey());
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Void> authenticated = new HttpEntity<>(headers);

            assertAll("n8n consumer contract",
                    () -> assertThat(client.getSystemInfo(target.baseUrl(), target.apiKey()).status())
                            .as("online status").isEqualTo("online"),
                    () -> assertThat(client.getSystemInfo(target.baseUrl() + "/", target.apiKey()).version())
                            .as("installed version").isEqualTo(target.version()),
                    () -> assertThat(client.getSystemInfo(target.baseUrl(), "invalid-contract-key").status())
                            .as("invalid API key").isEqualTo("auth_error"),
                    () -> assertThat(client.getSystemInfo(target.baseUrl(), null).status())
                            .as("missing API key").isEqualTo("auth_error"),
                    () -> assertThatThrownBy(() -> client.fetchExecutionErrors(
                            target.baseUrl(), "invalid-contract-key", 10, null))
                            .isInstanceOf(HttpClientErrorException.Unauthorized.class),
                    () -> assertThatThrownBy(() -> client.fetchExecutionErrorSummaries(
                            target.baseUrl(), "invalid-contract-key", 10, null))
                            .isInstanceOf(HttpClientErrorException.Unauthorized.class),
                    () -> verifyWorkflows(client, target),
                    () -> {
                        Map<String, Object> exported = new LinkedHashMap<>(failingWorkflow());
                        exported.put("id", "read-only-id");
                        exported.put("active", false);
                        assertThatThrownBy(() -> rest.exchange(target.baseUrl() + "/api/v1/workflows",
                                HttpMethod.POST, new HttpEntity<>(exported, headers), Map.class))
                                .as("workflow creation rejects read-only fields")
                                .isInstanceOf(HttpClientErrorException.BadRequest.class);
                    },
                    () -> verifyErrors(client, target),
                    () -> verifyExecutionShape(rest, authenticated, target, true),
                    () -> verifyExecutionShape(rest, authenticated, target, false),
                    () -> verifyHealth(http, target));
        } finally {
            http.close();
        }
    }

    private static void verifyWorkflows(N8nApiClient client, Target target) {
        assertThat(client.getRawWorkflows(target.baseUrl(), target.apiKey())).singleElement().satisfies(workflow -> {
            assertThat(workflow).containsEntry("id", target.workflowId())
                    .containsEntry("name", WORKFLOW_NAME).containsEntry("active", false);
            assertThat(workflow.get("nodes")).isInstanceOf(List.class);
            assertThat(workflow.get("connections")).isInstanceOf(Map.class);
        });
        assertThat(client.getWorkflows(target.baseUrl(), target.apiKey())).singleElement().satisfies(workflow -> {
            assertThat(workflow.getId()).isEqualTo(target.workflowId());
            assertThat(workflow.getName()).isEqualTo(WORKFLOW_NAME);
            assertThat(workflow.isActive()).isFalse();
            assertThat(workflow.getLastRunAt()).isEqualTo(target.startedAt());
            assertThat(workflow.getLastErrorAt()).isEqualTo(target.startedAt());
        });
    }

    private static void verifyErrors(N8nApiClient client, Target target) {
        Instant beforeExecution = target.startedAt().minusSeconds(1);
        assertThat(client.fetchExecutionErrors(target.baseUrl(), target.apiKey(), 10, beforeExecution))
                .singleElement().satisfies(event -> {
                    verifyEvent(event, target);
                    assertThat(event.getPayload()).containsEntry("errorMessage", ERROR_MESSAGE);
                });
        assertThat(client.fetchExecutionErrorSummaries(target.baseUrl(), target.apiKey(), 10, beforeExecution))
                .singleElement().satisfies(event -> {
                    verifyEvent(event, target);
                    assertThat(event.getPayload()).doesNotContainKey("errorMessage");
                });
        // The watermark is exclusive, including when a caller supplies the exact execution timestamp.
        assertThat(client.fetchExecutionErrors(target.baseUrl(), target.apiKey(), 10, target.startedAt())).isEmpty();
        assertThat(client.fetchExecutionErrorSummaries(target.baseUrl(), target.apiKey(), 10, target.startedAt())).isEmpty();
    }

    private static void verifyEvent(EventDto event, Target target) {
        assertThat(event.getId()).isEqualTo(target.executionId());
        assertThat(event.getEventType()).isEqualTo("WORKFLOW_ERROR");
        assertThat(event.getSeverity()).isEqualTo("ERROR");
        assertThat(event.getOccurredAt()).isEqualTo(target.startedAt());
        assertThat(event.getPayload()).containsEntry("workflowId", target.workflowId())
                .containsEntry("workflowName", WORKFLOW_NAME).containsEntry("executionId", target.executionId());
    }

    private static void verifyExecutionShape(RestTemplate rest, HttpEntity<Void> authenticated,
                                             Target target, boolean includeData) {
        Map<?, ?> body = rest.exchange(target.baseUrl() + "/api/v1/executions?status=error&includeData=" + includeData,
                HttpMethod.GET, authenticated, Map.class).getBody();
        assertThat(body).isNotNull();
        assertThat(body.get("data")).isInstanceOf(List.class);
        List<?> data = (List<?>) body.get("data");
        assertThat(data).hasSize(1);
        assertThat(data.get(0)).isInstanceOf(Map.class);
        Map<?, ?> execution = (Map<?, ?>) data.get(0);
        assertThat(execution.get("id")).isEqualTo(target.executionId());
        assertThat(execution.get("workflowId")).isEqualTo(target.workflowId());
        assertThat(execution.get("status")).isEqualTo("error");
        if (includeData) {
            assertThat(execution.get("data")).isInstanceOf(Map.class);
            Map<?, ?> resultData = (Map<?, ?>) ((Map<?, ?>) execution.get("data")).get("resultData");
            assertThat(resultData).isNotNull();
            assertThat(((Map<?, ?>) resultData.get("error")).get("message")).isEqualTo(ERROR_MESSAGE);
            assertThat(execution.get("workflowData")).isInstanceOf(Map.class);
            assertThat(((Map<?, ?>) execution.get("workflowData")).get("name")).isEqualTo(WORKFLOW_NAME);
        } else {
            assertThat(execution.containsKey("data")).as("includeData=false omits data").isFalse();
            assertThat(execution.containsKey("workflowData")).as("includeData=false omits workflowData").isFalse();
        }
    }

    private static void verifyHealth(InstanceHttpClient http, Target target) {
        // Health endpoints must work without the public API key.
        assertThat(http.restTemplate().getForObject(target.baseUrl() + "/healthz", Map.class))
                .containsEntry("status", "ok");
        assertThat(http.restTemplate().getForObject(target.baseUrl() + "/healthz/readiness", Map.class))
                .containsEntry("status", "ok");
        Instance instance = new Instance();
        instance.setBaseUrl(target.baseUrl());
        DiagnosticContext context = new DiagnosticContext(instance, target::apiKey, "contract", Instant.now());
        HttpProbe probe = new HttpProbe(http);
        assertThat(new N8nHealthCheck(probe).run(context).status()).isEqualTo(DiagnosticStatus.OK);
        assertThat(new N8nReadinessCheck(probe).run(context).status()).isEqualTo(DiagnosticStatus.OK);
    }
}
