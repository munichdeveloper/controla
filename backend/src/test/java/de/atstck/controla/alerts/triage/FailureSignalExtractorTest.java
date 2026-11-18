package de.atstck.controla.alerts.triage;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static de.atstck.controla.alerts.triage.FailureSignal.ErrorCategory.*;
import static org.assertj.core.api.Assertions.assertThat;

class FailureSignalExtractorTest {
    @Test
    void extractsMetadataFromNestedExecutionData() {
        Map<String, Object> execution = Map.of("workflowId", "wf1", "retryOf", "42", "data", Map.of(
                "resultData", Map.of("error", Map.of("httpCode", "429", "name", "NodeApiError",
                        "message", "PRIVATE error", "node", Map.of("type", "n8n-nodes-base.httpRequest",
                                "name", "PRIVATE node", "credentials", Map.of("key", "PRIVATE key"))))));

        assertThat(FailureSignalExtractor.fromExecution(execution)).isEqualTo(new FailureSignal(
                "wf1", "n8n-nodes-base.httpRequest", 429, RATE_LIMIT, true, null));
    }

    @Test
    void recognizesTimeoutCodeAndResolvesLastExecutedNodeTypeLocally() {
        Map<String, Object> execution = Map.of("workflowId", "wf1",
                "resultData", Map.of("error", Map.of("code", "ETIMEDOUT"), "lastNodeExecuted", "PRIVATE node"),
                "workflowData", Map.of("nodes", List.of(Map.of("name", "PRIVATE node", "type", "n8n-nodes-base.httpRequest"))));

        assertThat(FailureSignalExtractor.fromExecution(execution)).isEqualTo(new FailureSignal(
                "wf1", "n8n-nodes-base.httpRequest", null, TIMEOUT, false, null));
    }

    @Test
    void missingOrUntrustedMetadataStaysUnknown() {
        assertThat(FailureSignalExtractor.fromExecution(Map.of())).isEqualTo(
                new FailureSignal(null, null, null, UNKNOWN, false, null));
        assertThat(FailureSignalExtractor.fromExecution(Map.of("workflowId", "https://private.example",
                "resultData", Map.of("error", Map.of("node", Map.of("type", "https://private.example"))))))
                .extracting(FailureSignal::workflowId, FailureSignal::nodeType).containsOnlyNulls();
    }

    @Test
    void recognizesN8nTimeoutHttpCodeWithoutSendingItsMessage() {
        FailureSignal signal = FailureSignalExtractor.fromExecution(Map.of("workflowId", "wf1", "retryOf", "42",
                "resultData", Map.of("error", Map.of("name", "NodeApiError", "httpCode", "ETIMEDOUT",
                        "message", "PRIVATE timeout message"))));
        assertThat(signal.errorCategory()).isEqualTo(TIMEOUT);
        assertThat(signal.httpStatus()).isNull();
        assertThat(signal.retry()).isTrue();
    }
}
