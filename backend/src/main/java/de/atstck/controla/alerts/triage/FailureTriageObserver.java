package de.atstck.controla.alerts.triage;

import de.atstck.controla.dto.EventDto;
import de.atstck.controla.instance.Instance;
import de.atstck.controla.service.N8nApiClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;

/** Observes forwarding to the alert handler; it never determines whether a notification is sent. */
public class FailureTriageObserver {
    private static final Logger logger = LoggerFactory.getLogger(FailureTriageObserver.class);
    private final FailureTriageClassifier classifier;
    private final N8nApiClient client;

    public FailureTriageObserver(FailureTriageClassifier classifier, N8nApiClient client) {
        this.classifier = classifier;
        this.client = client;
    }

    public Map<String, Integer> failureCounts(Instance instance, String apiKey) {
        try {
            Instant cutoff = Instant.now().minus(Duration.ofHours(24));
            return client.fetchExecutionFailureCounts(instance.getBaseUrl(), apiKey, cutoff);
        } catch (Exception e) {
            logger.warn("Failure triage history unavailable: reasonCode=history_error");
            return Map.of();
        }
    }

    public void observeForwarded(Instance instance, EventDto error, Map<String, Integer> counts) {
        String workflowId = null;
        TriageDecision decision;
        try {
            FailureSignal signal = error.getFailureSignal();
            if (signal == null) {
                Object id = error.getPayload() == null ? null : error.getPayload().get("workflowId");
                signal = new FailureSignal(id instanceof String text ? text : null, null, null,
                        FailureSignal.ErrorCategory.UNKNOWN, false, null);
            }
            workflowId = signal.workflowId();
            Integer count = workflowId == null ? null : counts.get(workflowId);
            decision = classifier.classify(signal.withFailureCount24h(count));
            if (decision == null) {
                decision = TriageDecision.unsure("invalid_decision");
            }
        } catch (Exception e) {
            decision = TriageDecision.unsure("classifier_error");
        }
        logger.info("Failure triage shadow: instanceId={} workflowId={} decision={} confidence={} reasonCode={} actualAction=forwarded_to_alert_handler",
                instance.getExternalId(), workflowId, decision.decision(), decision.confidence(), decision.reasonCode());
    }
}
