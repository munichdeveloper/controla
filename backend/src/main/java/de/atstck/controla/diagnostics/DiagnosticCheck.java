package de.atstck.controla.diagnostics;

/**
 * Extension point: one check of the instance diagnostic report.
 * Community checks talk to n8n over HTTP; further modules (e.g. Premium with
 * the n8n companion) contribute additional checks as beans. Checks run in
 * parallel and independently; a check that throws or times out becomes an
 * {@link DiagnosticStatus#ERROR} result instead of failing the report.
 */
public interface DiagnosticCheck {

    /** Stable id, e.g. {@code n8n.health}. */
    String id();

    DiagnosticCategory category();

    /** Display title. */
    String title();

    /** Order within the category (ascending). */
    default int order() {
        return 100;
    }

    /** {@code false} omits the check from the report (e.g. TLS check for http URLs). */
    default boolean appliesTo(DiagnosticContext context) {
        return true;
    }

    DiagnosticResult run(DiagnosticContext context) throws Exception;
}
