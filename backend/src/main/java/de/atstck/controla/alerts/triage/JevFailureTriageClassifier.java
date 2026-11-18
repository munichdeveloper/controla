package de.atstck.controla.alerts.triage;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

public class JevFailureTriageClassifier implements FailureTriageClassifier {
    private static final Logger logger = LoggerFactory.getLogger(JevFailureTriageClassifier.class);
    private static final URI ENDPOINT = URI.create("https://api.typesafe.ai/v1/systemone");
    private final String apiKey;
    private final HttpClient client;
    private final ObjectMapper mapper = new ObjectMapper()
            .enable(DeserializationFeature.FAIL_ON_MISSING_CREATOR_PROPERTIES,
                    DeserializationFeature.FAIL_ON_NULL_FOR_PRIMITIVES,
                    DeserializationFeature.FAIL_ON_TRAILING_TOKENS);

    public JevFailureTriageClassifier(String apiKey) {
        this(apiKey, HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(1))
                .followRedirects(HttpClient.Redirect.NEVER).build());
    }

    JevFailureTriageClassifier(String apiKey, HttpClient client) {
        this.apiKey = apiKey;
        this.client = client;
    }

    @Override
    public TriageDecision classify(FailureSignal signal) {
        CompletableFuture<HttpResponse<String>> pending = null;
        try {
            HttpRequest request = HttpRequest.newBuilder(ENDPOINT).timeout(Duration.ofSeconds(1))
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(signal))).build();
            pending = client.sendAsync(request, HttpResponse.BodyHandlers.ofString());
            // Bound the entire response, including the body, rather than only connection/header time.
            HttpResponse<String> response = pending.get(1, TimeUnit.SECONDS);
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                logger.warn("Failure triage provider failed: provider=jev reasonCode=http_error");
                return TriageDecision.unsure("provider_http_error");
            }
            TriageDecision decision = mapper.readValue(response.body(), TriageDecision.class);
            if (decision == null) {
                throw new IllegalArgumentException("Missing triage decision");
            }
            return decision;
        } catch (TimeoutException e) {
            logger.warn("Failure triage provider failed: provider=jev reasonCode=timeout");
            return TriageDecision.unsure("provider_timeout");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            logger.warn("Failure triage provider failed: provider=jev reasonCode=interrupted");
            return TriageDecision.unsure("provider_interrupted");
        } catch (Exception e) {
            // Never log response bodies or exception messages: these may contain sensitive data.
            logger.warn("Failure triage provider failed: provider=jev reasonCode=provider_error");
            return TriageDecision.unsure("provider_error");
        } finally {
            if (pending != null && !pending.isDone()) {
                pending.cancel(true);
            }
        }
    }
}
