package de.atstck.controla.alerts.triage;

/** Extension point for shadow classification; decisions must never control alert delivery. */
@FunctionalInterface
public interface FailureTriageClassifier {
    TriageDecision classify(FailureSignal signal);
}
