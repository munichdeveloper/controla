package de.atstck.controla.diagnostics;

import java.time.Instant;
import java.util.List;

/**
 * Response of {@code GET /api/instances/{id}/diagnostics}. {@code incomplete} is true when
 * {@code incompleteChecks} checks did not finish (timeout); they do not influence
 * {@code overallStatus}.
 */
public record DiagnosticReportDto(
        String instanceId,
        Instant generatedAt,
        long durationMs,
        DiagnosticStatus overallStatus,
        List<DiagnosticConclusion> conclusions,
        List<DiagnosticResult> checks,
        boolean incomplete,
        int incompleteChecks) {

    public DiagnosticReportDto(String instanceId, Instant generatedAt, long durationMs, DiagnosticStatus overallStatus,
                               List<DiagnosticConclusion> conclusions, List<DiagnosticResult> checks) {
        this(instanceId, generatedAt, durationMs, overallStatus, conclusions, checks, false, 0);
    }
}
