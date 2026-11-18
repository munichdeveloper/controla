package de.atstck.controla.alerts.triage;

import java.util.Map;

import static de.atstck.controla.alerts.triage.FailureSignal.ErrorCategory.*;

/** Extracts typed metadata locally, without retaining messages, node parameters or execution data. */
public final class FailureSignalExtractor {
    private FailureSignalExtractor() { }

    public static FailureSignal fromExecution(Map<String, Object> execution) {
        Map<?, ?> result = map(execution.get("resultData"));
        if (result.isEmpty()) {
            result = map(map(execution.get("data")).get("resultData"));
        }
        Map<?, ?> error = map(result.get("error"));
        Map<?, ?> node = map(error.get("node"));
        String nodeType = identifier(node.get("type"), "[A-Za-z0-9_@.\\-/]{1,128}");
        if (nodeType == null && result.get("lastNodeExecuted") instanceof String lastNode) {
            Object nodes = map(execution.get("workflowData")).get("nodes");
            if (nodes instanceof Iterable<?> iterable) {
                for (Object candidate : iterable) {
                    Map<?, ?> definition = map(candidate);
                    if (lastNode.equals(definition.get("name"))) {
                        nodeType = identifier(definition.get("type"), "[A-Za-z0-9_@.\\-/]{1,128}");
                        break;
                    }
                }
            }
        }
        Integer status = null;
        for (Object value : new Object[] {error.get("httpCode"), error.get("statusCode"),
                error.get("status"), map(error.get("response")).get("statusCode"),
                map(error.get("response")).get("status")}) {
            if (value != null && value.toString().matches("[1-5][0-9]{2}")) {
                status = Integer.valueOf(value.toString());
                break;
            }
        }
        FailureSignal.ErrorCategory category = UNKNOWN;
        if (isTimeout(error.get("code")) || isTimeout(error.get("httpCode"))
                || isTimeout(error.get("name")) || isTimeout(map(error.get("cause")).get("code"))
                || Integer.valueOf(408).equals(status)
                || Integer.valueOf(504).equals(status)) {
            category = TIMEOUT;
        } else if (Integer.valueOf(429).equals(status)) {
            category = RATE_LIMIT;
        } else if (Integer.valueOf(401).equals(status) || Integer.valueOf(403).equals(status)) {
            category = AUTHENTICATION;
        } else if (!error.isEmpty()) {
            category = OTHER;
        }
        Object retryOf = execution.get("retryOf");
        boolean retry = retryOf != null && !retryOf.toString().isBlank();
        return new FailureSignal(identifier(execution.get("workflowId"), "[A-Za-z0-9_-]{1,128}"),
                nodeType, status, category, retry, null);
    }

    private static Map<?, ?> map(Object value) {
        return value instanceof Map<?, ?> map ? map : Map.of();
    }

    private static boolean isTimeout(Object value) {
        return value instanceof String text && switch (text) {
            case "ETIMEDOUT", "ESOCKETTIMEDOUT", "ECONNABORTED", "TimeoutError", "NodeTimeoutError" -> true;
            default -> false;
        };
    }

    private static String identifier(Object value, String pattern) {
        return value instanceof String text && text.matches(pattern) ? text : null;
    }
}
