package de.atstck.controla.alerts.triage;

import static de.atstck.controla.alerts.triage.FailureSignal.ErrorCategory.*;
import static de.atstck.controla.alerts.triage.TriageDecision.Decision.*;

public class RuleBasedFailureTriageClassifier implements FailureTriageClassifier {
    @Override
    public TriageDecision classify(FailureSignal signal) {
        // A persistent failure takes precedence over a transient-looking retry.
        if (signal.failureCount24h() != null && signal.failureCount24h() >= 3) {
            return new TriageDecision(ALERT, 0.9, "repeated_workflow_failure");
        }
        if (signal.retry() && (Integer.valueOf(429).equals(signal.httpStatus())
                || signal.errorCategory() == RATE_LIMIT || signal.errorCategory() == TIMEOUT
                || Integer.valueOf(408).equals(signal.httpStatus())
                || Integer.valueOf(504).equals(signal.httpStatus()))) {
            return new TriageDecision(NOISE, 0.8, "transient_retry");
        }
        return TriageDecision.unsure("insufficient_evidence");
    }
}
