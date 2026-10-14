package de.atstck.controla.diagnostics;

import java.util.List;

/**
 * Finding derived from several check results (e.g. "n8n runs, but is not
 * reachable from outside"). Shown above the individual checks.
 */
public record DiagnosticConclusion(
        String id,
        DiagnosticStatus severity,
        String title,
        String explanation,
        List<String> relatedCheckIds) {

    public DiagnosticConclusion {
        relatedCheckIds = relatedCheckIds == null ? List.of() : List.copyOf(relatedCheckIds);
    }
}
