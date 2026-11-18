package de.atstck.controla.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import de.atstck.controla.alerts.triage.FailureSignal;
import de.atstck.controla.dto.EventDto;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class N8nApiClientTriageTest {
    private final RestTemplate rest = new RestTemplate();
    private final MockRestServiceServer server = MockRestServiceServer.bindTo(rest).build();
    private final N8nApiClient client = client();
    private final ObjectMapper mapper = new ObjectMapper();
    private static final Instant CUTOFF = Instant.parse("2026-11-17T12:00:00Z");
    private static final String COUNTS_URL = "https://n8n.example/api/v1/executions?status=error&includeData=false&limit=100";

    @Test
    void countsAcrossPagesDeduplicatesAndStopsAtWindowBoundary() throws Exception {
        expect(COUNTS_URL, Map.of("data", List.of(execution("1", "wf1", CUTOFF.plusSeconds(60)),
                execution("2", "wf2", CUTOFF.plusSeconds(60))), "nextCursor", "page2"));
        expect(COUNTS_URL + "&cursor=page2", Map.of("data", List.of(
                execution("1", "wf1", CUTOFF.plusSeconds(60)), execution("3", "wf1", CUTOFF.plusSeconds(30)),
                execution("4", "wf1", CUTOFF)), "nextCursor", "page3"));

        assertThat(client.fetchExecutionFailureCounts("https://n8n.example/", "key", CUTOFF))
                .containsExactlyInAnyOrderEntriesOf(Map.of("wf1", 2, "wf2", 1));
        server.verify();
    }

    @Test
    void repeatedCursorFailsInsteadOfReturningMisleadingCounts() throws Exception {
        expect(COUNTS_URL, Map.of("data", List.of(execution("1", "wf1", CUTOFF.plusSeconds(60))), "nextCursor", "same"));
        expect(COUNTS_URL + "&cursor=same", Map.of("data", List.of(), "nextCursor", "same"));

        assertThatIllegalStateException().isThrownBy(() -> client.fetchExecutionFailureCounts("https://n8n.example", "key", CUTOFF));
        server.verify();
    }

    @Test
    void enabledMappingKeepsMetadataInternalAndAlertPayloadUnchanged() throws Exception {
        ReflectionTestUtils.setField(client, "failureTriageEnabled", true);
        EventDto event = fetchFailure();

        assertThat(event.getFailureSignal()).isEqualTo(new FailureSignal("wf1", "n8n-nodes-base.httpRequest",
                429, FailureSignal.ErrorCategory.RATE_LIMIT, true, null));
        assertThat(event.getPayload()).containsOnlyKeys("workflowId", "workflowName", "errorMessage", "executionId")
                .containsEntry("errorMessage", "PRIVATE message");
        // EventDto's HTTP representation must not gain a failureSignal field.
        event.setOccurredAt(null);
        assertThat(mapper.readTree(mapper.writeValueAsString(event)).has("failureSignal")).isFalse();
    }

    @Test
    void defaultMappingDoesNotExtractTriageMetadata() throws Exception {
        assertThat(fetchFailure().getFailureSignal()).isNull();
    }

    private EventDto fetchFailure() throws Exception {
        expect("https://n8n.example/api/v1/executions?status=error&includeData=true&limit=50", Map.of("data", List.of(Map.of(
                "id", "1", "workflowId", "wf1", "retryOf", "42", "startedAt", CUTOFF.plusSeconds(60).toString(),
                "workflowName", "PRIVATE workflow", "data", Map.of("resultData", Map.of("error", Map.of(
                        "message", "PRIVATE message", "httpCode", "429", "node", Map.of("type", "n8n-nodes-base.httpRequest"))))))));
        EventDto event = client.fetchExecutionErrors("https://n8n.example", "key", 50, CUTOFF).get(0);
        server.verify();
        return event;
    }

    private void expect(String url, Map<String, Object> body) throws Exception {
        server.expect(requestTo(url)).andExpect(method(HttpMethod.GET)).andExpect(header("X-N8N-API-KEY", "key"))
                .andRespond(withSuccess(mapper.writeValueAsString(body), MediaType.APPLICATION_JSON));
    }

    private static Map<String, Object> execution(String id, String workflow, Instant started) {
        return Map.of("id", id, "workflowId", workflow, "startedAt", started.toString());
    }

    private N8nApiClient client() {
        InstanceHttpClient http = mock(InstanceHttpClient.class);
        when(http.restTemplate()).thenReturn(rest);
        return new N8nApiClient(http);
    }
}
