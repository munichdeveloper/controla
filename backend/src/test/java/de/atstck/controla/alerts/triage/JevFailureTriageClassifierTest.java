package de.atstck.controla.alerts.triage;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Flow;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

import static de.atstck.controla.alerts.triage.FailureSignal.ErrorCategory.RATE_LIMIT;
import static de.atstck.controla.alerts.triage.TriageDecision.Decision.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class JevFailureTriageClassifierTest {
    private final HttpClient client = mock(HttpClient.class);
    private final JevFailureTriageClassifier classifier = new JevFailureTriageClassifier("PRIVATE_API_KEY", client);
    private final FailureSignal signal = new FailureSignal("wf1", "n8n-nodes-base.httpRequest", 429, RATE_LIMIT, true, 1);

    @Test
    void sendsExactlyTheMetadataAllowlistAndParsesTypedDecision() throws Exception {
        respond(200, answer("NOISE", "0.8"));
        FailureSignal metadata = FailureSignalExtractor.fromExecution(Map.of("workflowId", "wf1", "retryOf", "42",
                "instanceName", "PRIVATE_INSTANCE_NAME", "payload", Map.of("value", "PRIVATE_PAYLOAD"),
                "resultData", Map.of("error", Map.of("httpCode", "429", "message", "PRIVATE_ERROR_MESSAGE",
                        "node", Map.of("type", "n8n-nodes-base.httpRequest", "credentials", "PRIVATE_CREDENTIALS")))))
                .withFailureCount24h(1);

        assertThat(classifier.classify(metadata)).isEqualTo(new TriageDecision(NOISE, 0.8, "jev_choice"));

        ArgumentCaptor<HttpRequest> captured = ArgumentCaptor.forClass(HttpRequest.class);
        verify(client).sendAsync(captured.capture(), any(HttpResponse.BodyHandler.class));
        HttpRequest request = captured.getValue();
        assertThat(request.uri().toString()).isEqualTo("https://api.typesafe.ai/v1/systemone");
        assertThat(request.method()).isEqualTo("POST");
        assertThat(request.timeout()).contains(Duration.ofSeconds(5));
        assertThat(request.headers().firstValue("Authorization")).contains("Bearer PRIVATE_API_KEY");
        String body = requestBody(request);
        JsonNode json = new ObjectMapper().readTree(body);
        assertThat(json.get("model").asText()).isEqualTo("jev-latest");
        String state = json.get("state").asText();
        assertThat(state).contains("wf1", "n8n-nodes-base.httpRequest", "429", "RATE_LIMIT", "true");
        JsonNode triage = json.get("questions").get("triage");
        assertThat(triage.get("type").asText()).isEqualTo("choice");
        assertThat(triage.get("criteria").has("ALERT")).isTrue();
        assertThat(triage.get("criteria").has("NOISE")).isTrue();
        assertThat(state).doesNotContain("PRIVATE_ERROR_MESSAGE", "PRIVATE_PAYLOAD", "PRIVATE_INSTANCE_NAME",
                "PRIVATE_CREDENTIALS", "https://");
        assertThat(body).doesNotContain("errorMessage", "message", "payload", "instanceName", "workflowName",
                "credentials", "PRIVATE_API_KEY", "PRIVATE_INSTANCE_NAME", "PRIVATE_PAYLOAD",
                "PRIVATE_ERROR_MESSAGE", "PRIVATE_CREDENTIALS", "https://");
    }

    @Test
    void mapsAlertChoiceAndConfiguredModelAndTimeout() throws Exception {
        JevFailureTriageClassifier custom = new JevFailureTriageClassifier("K", "my-model", 2000, client);
        respond(200, answer("ALERT", "0.9"));
        assertThat(custom.classify(signal)).isEqualTo(new TriageDecision(ALERT, 0.9, "jev_choice"));
        ArgumentCaptor<HttpRequest> captured = ArgumentCaptor.forClass(HttpRequest.class);
        verify(client).sendAsync(captured.capture(), any(HttpResponse.BodyHandler.class));
        assertThat(captured.getValue().timeout()).contains(Duration.ofSeconds(2));
        assertThat(new ObjectMapper().readTree(requestBody(captured.getValue())).get("model").asText())
                .isEqualTo("my-model");
    }

    @Test
    void deadlineCoversEntireResponseAndCancelsRequest() throws Exception {
        CompletableFuture<HttpResponse<String>> pending = mock(CompletableFuture.class);
        doReturn(pending).when(client).sendAsync(any(HttpRequest.class), any(HttpResponse.BodyHandler.class));
        when(pending.get(5000, TimeUnit.MILLISECONDS)).thenThrow(new TimeoutException());

        assertThat(classifier.classify(signal)).isEqualTo(TriageDecision.unsure("provider_timeout"));
        verify(pending).cancel(true);
    }

    @Test
    void networkErrorIsUnsure() {
        doReturn(CompletableFuture.failedFuture(new IOException("PRIVATE error response")))
                .when(client).sendAsync(any(HttpRequest.class), any(HttpResponse.BodyHandler.class));
        assertThat(classifier.classify(signal).decision()).isEqualTo(UNSURE);
    }

    @Test
    void httpErrorIsUnsure() {
        respond(503, "PRIVATE response");
        assertThat(classifier.classify(signal)).isEqualTo(TriageDecision.unsure("provider_http_error"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"not json", "null", "{}", "{\"answers\":{}}",
            "{\"answers\":{\"triage\":{\"choice\":\"ALERT\"}}}",
            "{\"answers\":{\"triage\":{\"choice\":\"ALERT\",\"confidence\":1.1}}}",
            "{\"answers\":{\"triage\":{\"choice\":\"SUPPRESS\",\"confidence\":0.9}}}",
            "{\"answers\":{\"triage\":{\"choice\":null,\"confidence\":0.9}}}"})
    void invalidResponseIsUnsure(String response) {
        respond(200, response);
        assertThat(classifier.classify(signal).decision()).isEqualTo(UNSURE);
    }

    private static String answer(String choice, String confidence) {
        return "{\"model\":\"jev-latest\",\"answers\":{\"triage\":{\"choice\":\""+ choice
                + "\",\"confidence\":" + confidence + ",\"probabilities\":{}}},\"usage\":{}}";
    }

    private void respond(int status, String body) {
        HttpResponse<String> response = mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(status);
        when(response.body()).thenReturn(body);
        doReturn(CompletableFuture.completedFuture(response)).when(client)
                .sendAsync(any(HttpRequest.class), any(HttpResponse.BodyHandler.class));
    }

    private static String requestBody(HttpRequest request) {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        CompletableFuture<String> result = new CompletableFuture<>();
        request.bodyPublisher().orElseThrow().subscribe(new Flow.Subscriber<ByteBuffer>() {
            public void onSubscribe(Flow.Subscription subscription) { subscription.request(Long.MAX_VALUE); }
            public void onNext(ByteBuffer buffer) {
                byte[] chunk = new byte[buffer.remaining()];
                buffer.get(chunk);
                bytes.writeBytes(chunk);
            }
            public void onError(Throwable error) { result.completeExceptionally(error); }
            public void onComplete() { result.complete(bytes.toString(StandardCharsets.UTF_8)); }
        });
        return result.join();
    }
}
