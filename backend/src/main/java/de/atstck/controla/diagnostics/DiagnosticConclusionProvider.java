package de.atstck.controla.diagnostics;

import java.util.List;

/** Extension point: derives conclusions from the results of all checks. */
public interface DiagnosticConclusionProvider {
    List<DiagnosticConclusion> conclude(DiagnosticContext context, List<DiagnosticResult> results);
}
