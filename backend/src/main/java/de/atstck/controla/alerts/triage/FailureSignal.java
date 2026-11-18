package de.atstck.controla.alerts.triage;

/** The complete allowlist of metadata that may be sent to an external classifier. */
public record FailureSignal(String workflowId, String nodeType, Integer httpStatus,
                            ErrorCategory errorCategory, boolean retry, Integer failureCount24h) {
    public enum ErrorCategory { TIMEOUT, RATE_LIMIT, AUTHENTICATION, OTHER, UNKNOWN }

    public FailureSignal {
        workflowId = identifier(workflowId, "[A-Za-z0-9_-]{1,128}");
        nodeType = identifier(nodeType, "[A-Za-z0-9_@.\\-/]{1,128}");
        httpStatus = httpStatus != null && httpStatus >= 100 && httpStatus <= 599 ? httpStatus : null;
        errorCategory = errorCategory == null ? ErrorCategory.UNKNOWN : errorCategory;
        if (failureCount24h != null && failureCount24h < 0) {
            throw new IllegalArgumentException("Failure count must be non-negative");
        }
    }

    public FailureSignal withFailureCount24h(Integer count) {
        return new FailureSignal(workflowId, nodeType, httpStatus, errorCategory, retry, count);
    }

    private static String identifier(String value, String pattern) {
        return value != null && value.matches(pattern) ? value : null;
    }
}
