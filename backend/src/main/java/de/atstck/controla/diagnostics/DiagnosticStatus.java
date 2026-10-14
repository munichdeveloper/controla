package de.atstck.controla.diagnostics;

/** Outcome of a single check, ordered from best to worst for aggregation. */
public enum DiagnosticStatus {
    OK,
    SKIPPED,
    WARN,
    FAIL,
    ERROR
}
