package de.atstck.controla.alerts.triage;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
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
    private static final String QUESTION = "triage";
    public static final String DEFAULT_MODEL = "jev-latest";
    public static final long DEFAULT_TIMEOUT_MS = 5000;
    private final String apiKey;
    private final String model;
    private final Duration timeout;
    private final HttpClient client;
    private final ObjectMapper mapper = new ObjectMapper();

    public JevFailureTriageClassifier(String apiKey, String model, long timeoutMs) {
        this(apiKey, model, timeoutMs, HttpClient.newBuilder().connectTimeout(Duration.ofMillis(timeoutMs))
                .followRedirects(HttpClient.Redirect.NEVER).build());
    }

    JevFailureTriageClassifier(String apiKey, HttpClient client) {
        this(apiKey, DEFAULT_MODEL, DEFAULT_TIMEOUT_MS, client);
    }

    JevFailureTriageClassifier(String apiKey, String model, long timeoutMs, HttpClient client) {
        this.apiKey = apiKey;
        this.model = model == null || model.isBlank() ? DEFAULT_MODEL : model.trim();
        this.timeout = Duration.ofMillis(timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS);
        this.client = client;
    }

    String requestBody(FailureSignal signal) throws Exception {
        ObjectNode root = mapper.createObjectNode();
        root.put("model", model);
        root.put("state", state(signal));
        ObjectNode question = root.putObject("questions").putObject(QUESTION);
        question.put("type", "choice");
        question.put("instructions", "Decide whether this n8n workflow failure needs a human alert (ALERT) "
                + "or is transient noise that can be ignored (NOISE). / Entscheide, ob dieser n8n-Workflow-Fehler "
                + "einen Alarm erfordert (ALERT) oder nur vorübergehendes Rauschen ist (NOISE).");
        ObjectNode criteria = question.putObject("criteria");
        criteria.put("ALERT", "A person should look at this: repeated failures, authentication problems or "
                + "persistent errors. / Ein Mensch sollte sich das ansehen: wiederholte Fehler, "
                + "Authentifizierungsprobleme oder dauerhafte Fehler.");
        criteria.put("NOISE", "Transient and likely self-healing: a single timeout or rate limit that is retried. "
                + "/ Vorübergehend und voraussichtlich selbstheilend: einzelner Timeout oder Rate-Limit mit Wiederholung.");
        return mapper.writeValueAsString(root);
    }

    static String state(FailureSignal s) {
        return "Workflow id: " + s.workflowId() + "\nNode type: " + s.nodeType()
                + "\nHTTP status: " + (s.httpStatus() == null ? "unknown" : s.httpStatus())
                + "\nError category: " + s.errorCategory()
                + "\nRetry: " + s.retry()
                + "\nFailures in last 24 h: " + (s.failureCount24h() == null ? "unknown" : s.failureCount24h());
    }

    private TriageDecision parse(String body) throws Exception {
        JsonNode answer = mapper.readTree(body).path("answers").path(QUESTION);
        JsonNode choice = answer.path("choice");
        JsonNode confidence = answer.path("confidence");
        if (!choice.isTextual() || !confidence.isNumber()) {
            return TriageDecision.unsure("jev_invalid_answer");
        }
        double value = confidence.asDouble();
        if (!Double.isFinite(value) || value < 0 || value > 1) {
            return TriageDecision.unsure("jev_invalid_answer");
        }
        return switch (choice.asText()) {
            case "ALERT" -> new TriageDecision(TriageDecision.Decision.ALERT, value, "jev_choice");
            case "NOISE" -> new TriageDecision(TriageDecision.Decision.NOISE, value, "jev_choice");
            default -> TriageDecision.unsure("jev_invalid_answer");
        };
    }

    @Override
    public TriageDecision classify(FailureSignal signal) {
        CompletableFuture<HttpResponse<String>> pending = null;
        try {
            HttpRequest request = HttpRequest.newBuilder(ENDPOINT).timeout(timeout)
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody(signal))).build();
            pending = client.sendAsync(request, HttpResponse.BodyHandlers.ofString());
            // Bound the entire response, including the body, rather than only connection/header time.
            HttpResponse<String> response = pending.get(timeout.toMillis(), TimeUnit.MILLISECONDS);
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                logger.warn("Failure triage provider failed: provider=jev reasonCode=http_error");
                return TriageDecision.unsure("provider_http_error");
            }
            return parse(response.body());
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
