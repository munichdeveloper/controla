package de.atstck.controla.diagnostics;

import java.util.Map;

/**
 * Result of one {@link DiagnosticCheck}. {@code summary} states the finding,
 * {@code hint} what to do about it; {@code details} carries raw values for
 * the expandable section in the UI. {@code incomplete} marks a check that could
 * not finish (e.g. timeout); it is reported separately and does not drive the
 * overall status.
 */
public record DiagnosticResult(
        String id,
        DiagnosticCategory category,
        DiagnosticStatus status,
        String title,
        String summary,
        String hint,
        Map<String, Object> details,
        long durationMs,
        boolean incomplete) {

    public DiagnosticResult(String id, DiagnosticCategory category, DiagnosticStatus status, String title,
                            String summary, String hint, Map<String, Object> details, long durationMs) {
        this(id, category, status, title, summary, hint, details, durationMs, false);
    }

    public DiagnosticResult {
        details = details == null ? Map.of() : Map.copyOf(withoutNulls(details));
    }

    private static Map<String, Object> withoutNulls(Map<String, Object> details) {
        java.util.LinkedHashMap<String, Object> copy = new java.util.LinkedHashMap<>();
        details.forEach((k, v) -> {
            if (k != null && v != null) {
                copy.put(k, v);
            }
        });
        return copy;
    }

    public DiagnosticResult withDuration(long millis) {
        return new DiagnosticResult(id, category, status, title, summary, hint, details, millis, incomplete);
    }

    public static Builder of(DiagnosticCheck check) {
        return new Builder(check.id(), check.category(), check.title());
    }

    public static final class Builder {
        private final String id;
        private final DiagnosticCategory category;
        private final String title;
        private Map<String, Object> details = Map.of();
        private String hint;

        private Builder(String id, DiagnosticCategory category, String title) {
            this.id = id;
            this.category = category;
            this.title = title;
        }

        public Builder details(Map<String, Object> details) {
            this.details = details;
            return this;
        }

        public Builder hint(String hint) {
            this.hint = hint;
            return this;
        }

        public DiagnosticResult ok(String summary) {
            return build(DiagnosticStatus.OK, summary);
        }

        public DiagnosticResult warn(String summary) {
            return build(DiagnosticStatus.WARN, summary);
        }

        public DiagnosticResult fail(String summary) {
            return build(DiagnosticStatus.FAIL, summary);
        }

        public DiagnosticResult skipped(String summary) {
            return build(DiagnosticStatus.SKIPPED, summary);
        }

        public DiagnosticResult error(String summary) {
            return build(DiagnosticStatus.ERROR, summary);
        }

        /** Check that could not finish (timeout/abort): status ERROR, but flagged so it does not set the overall status. */
        public DiagnosticResult incomplete(String summary) {
            return new DiagnosticResult(id, category, DiagnosticStatus.ERROR, title, summary, hint, details, 0, true);
        }

        public DiagnosticResult build(DiagnosticStatus status, String summary) {
            return new DiagnosticResult(id, category, status, title, summary, hint, details, 0);
        }
    }
}
