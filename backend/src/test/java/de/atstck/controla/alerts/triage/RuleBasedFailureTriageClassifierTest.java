package de.atstck.controla.alerts.triage;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static de.atstck.controla.alerts.triage.FailureSignal.ErrorCategory.*;
import static de.atstck.controla.alerts.triage.TriageDecision.Decision.*;
import static org.assertj.core.api.Assertions.*;

class RuleBasedFailureTriageClassifierTest {
    private final FailureTriageClassifier classifier = new RuleBasedFailureTriageClassifier();

    @ParameterizedTest
    @ValueSource(ints = {429, 408, 504})
    void transientHttpFailureOnRetryIsNoise(int status) {
        TriageDecision decision = classifier.classify(new FailureSignal("wf1", null, status, UNKNOWN, true, 1));
        assertThat(decision.decision()).isEqualTo(NOISE);
        assertThat(decision.confidence()).isBetween(0.0, 1.0);
        assertThat(decision.reasonCode()).isEqualTo("transient_retry");
    }

    @Test
    void timeoutOnRetryIsNoiseWithoutHttpStatus() {
        assertThat(classifier.classify(new FailureSignal("wf1", null, null, TIMEOUT, true, 1)).decision())
                .isEqualTo(NOISE);
    }

    @Test
    void repeatedFailuresTakePrecedenceOverTransientRetry() {
        TriageDecision decision = classifier.classify(new FailureSignal("wf1", null, 429, RATE_LIMIT, true, 3));
        assertThat(decision.decision()).isEqualTo(ALERT);
        assertThat(decision.reasonCode()).isEqualTo("repeated_workflow_failure");
    }

    @Test
    void unknownFailureAndTransientFirstAttemptAreUnsure() {
        assertThat(classifier.classify(new FailureSignal(null, null, null, UNKNOWN, false, null)).decision())
                .isEqualTo(UNSURE);
        assertThat(classifier.classify(new FailureSignal("wf1", null, 429, RATE_LIMIT, false, 1)).decision())
                .isEqualTo(UNSURE);
    }

    @ParameterizedTest
    @ValueSource(doubles = {-0.1, 1.1, Double.NaN, Double.POSITIVE_INFINITY})
    void decisionRejectsInvalidConfidence(double confidence) {
        assertThatIllegalArgumentException().isThrownBy(() -> new TriageDecision(ALERT, confidence, "reason"));
    }

    @Test
    void decisionRejectsFreeTextReason() {
        assertThatIllegalArgumentException().isThrownBy(() -> new TriageDecision(ALERT, 0.9, "https://secret"));
    }
}
