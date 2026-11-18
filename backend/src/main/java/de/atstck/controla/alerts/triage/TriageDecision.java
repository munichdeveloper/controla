package de.atstck.controla.alerts.triage;

public record TriageDecision(Decision decision, double confidence, String reasonCode) {
    public enum Decision { ALERT, NOISE, UNSURE }

    public TriageDecision {
        if (decision == null || !Double.isFinite(confidence) || confidence < 0 || confidence > 1
                || reasonCode == null || !reasonCode.matches("[A-Za-z][A-Za-z0-9_]{0,63}")) {
            throw new IllegalArgumentException("Invalid triage decision");
        }
    }

    public static TriageDecision unsure(String reasonCode) {
        return new TriageDecision(Decision.UNSURE, 0, reasonCode);
    }
}
