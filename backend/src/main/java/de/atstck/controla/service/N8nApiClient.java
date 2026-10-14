package de.atstck.controla.service;

import de.atstck.controla.dto.EventDto;
import de.atstck.controla.dto.WorkflowDto;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class N8nApiClient {
    private static final Logger logger = LoggerFactory.getLogger(N8nApiClient.class);
    private static final int MAX_LIMIT_WITH_DATA = 100;
    private static final int SUMMARY_PAGE_SIZE = 100;
    private static final int MAX_SUMMARY_PAGES = 10;
    private static final int WORKFLOW_PAGE_SIZE = 250;
    private static final int MAX_WORKFLOW_PAGES = 10;
    private static final Duration WORKFLOW_NAME_TTL = Duration.ofMinutes(5);

    private record NameKey(String baseUrl, String apiKey) {
    }

    private record CachedNames(Map<String, String> names, Instant expiresAt) {
    }

    private final Map<NameKey, CachedNames> workflowNameCache = new java.util.concurrent.ConcurrentHashMap<>();
    private final RestTemplate restTemplate;
    private String cachedLatestVersion;
    private long lastVersionCheck = 0;
    private static final long VERSION_CHECK_INTERVAL = 3600000; // 1 hour

    public N8nApiClient(InstanceHttpClient instanceHttpClient) {
        // Customer-provided URLs: target policy applies (see InstanceHttpClient).
        this.restTemplate = instanceHttpClient.restTemplate();
    }

    public String getLatestN8nVersion() {
        if (System.currentTimeMillis() - lastVersionCheck < VERSION_CHECK_INTERVAL && cachedLatestVersion != null) {
            return cachedLatestVersion;
        }
        try {
            Map<String, Object> response = restTemplate.getForObject("https://registry.npmjs.org/n8n/latest", Map.class);
            if (response != null && response.containsKey("version")) {
                cachedLatestVersion = (String) response.get("version");
                lastVersionCheck = System.currentTimeMillis();
                return cachedLatestVersion;
            }
        } catch (Exception e) {
            // ignore
        }
        return cachedLatestVersion != null ? cachedLatestVersion : "unknown";
    }

    public SystemInfo getSystemInfo(String baseUrl, String apiKey) {
        if (baseUrl == null) {
            return new SystemInfo("offline", "unknown");
        }
        String url = baseUrl.replaceAll("/$", "") + "/api/v1/users";
        HttpHeaders headers = new HttpHeaders();
        if (apiKey != null) {
            headers.set("X-N8N-API-KEY", apiKey);
        }
        HttpEntity<Void> entity = new HttpEntity<>(headers);

        try {
            restTemplate.exchange(url, HttpMethod.GET, entity, Map.class);
            // If successful, we are online.
            String version = fetchVersion(baseUrl);
            return new SystemInfo("online", version);
        } catch (HttpClientErrorException.Unauthorized e) {
            return new SystemInfo("auth_error", "unknown");
        } catch (ResourceAccessException e) {
            return new SystemInfo("offline", "unknown");
        } catch (Exception e) {
            return new SystemInfo("error", "unknown");
        }
    }

    private String fetchVersion(String baseUrl) {
        try {
            String url = baseUrl.replaceAll("/$", "") + "/";
            String html = restTemplate.getForObject(url, String.class);
            if (html != null) {
                // Strategy 1: window.n8nVersion
                java.util.regex.Pattern pattern = java.util.regex.Pattern.compile("window\\.n8nVersion\\s*=\s*[\"']([^\"']+)[\"']");
                java.util.regex.Matcher matcher = pattern.matcher(html);
                if (matcher.find()) {
                    return matcher.group(1);
                }

                // Strategy 2: meta n8n:config:sentry
                java.util.regex.Pattern metaPattern = java.util.regex.Pattern.compile("name=\"n8n:config:sentry\"\\s+content=\"([^\"]+)\"");
                java.util.regex.Matcher metaMatcher = metaPattern.matcher(html);
                if (metaMatcher.find()) {
                    String content = metaMatcher.group(1);
                    try {
                        byte[] decodedBytes = java.util.Base64.getDecoder().decode(content);
                        String decodedString = new String(decodedBytes);
                        // Look for "release":"n8n@..."
                        java.util.regex.Pattern releasePattern = java.util.regex.Pattern.compile("\"release\"\\s*:\\s*\"n8n@([^\"]+)\"");
                        java.util.regex.Matcher releaseMatcher = releasePattern.matcher(decodedString);
                        if (releaseMatcher.find()) {
                            return releaseMatcher.group(1);
                        }
                    } catch (IllegalArgumentException e) {
                        // ignore invalid base64
                    }
                }
            }
        } catch (Exception e) {
            // ignore
        }
        return "unknown";
    }

    public List<Map<String, Object>> getRawWorkflows(String baseUrl, String apiKey) {
        if (baseUrl == null || apiKey == null) {
            return Collections.emptyList();
        }

        String url = baseUrl.replaceAll("/$", "") + "/api/v1/workflows";
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-N8N-API-KEY", apiKey);
        HttpEntity<Void> entity = new HttpEntity<>(headers);

        try {
            ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.GET, entity, Map.class);
            Map<String, Object> body = response.getBody();
            if (body != null && body.containsKey("data")) {
                return (List<Map<String, Object>>) body.get("data");
            }
        } catch (Exception e) {
            throw new RuntimeException("Failed to fetch raw workflows: " + e.getMessage(), e);
        }
        return new ArrayList<>();
    }

    public List<WorkflowDto> getWorkflows(String baseUrl, String apiKey) {
        if (baseUrl == null || apiKey == null) {
            return Collections.emptyList();
        }

        String url = baseUrl.replaceAll("/$", "") + "/api/v1/workflows";

        HttpHeaders headers = new HttpHeaders();
        headers.set("X-N8N-API-KEY", apiKey);

        HttpEntity<Void> entity = new HttpEntity<>(headers);

        List<WorkflowDto> workflows = new ArrayList<>();
        try {
            ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.GET, entity, Map.class);
            Map<String, Object> body = response.getBody();

            if (body != null && body.containsKey("data")) {
                List<Map<String, Object>> data = (List<Map<String, Object>>) body.get("data");
                workflows = data.stream().map(this::mapToWorkflowDto).collect(Collectors.toList());
            }
        } catch (Exception e) {
            throw new RuntimeException("Failed to fetch workflows from n8n: " + e.getMessage(), e);
        }

        // Fetch recent executions to populate lastRunAt and lastErrorAt
        try {
            String executionsUrl = baseUrl.replaceAll("/$", "") + "/api/v1/executions?limit=250";
            ResponseEntity<Map> execResponse = restTemplate.exchange(executionsUrl, HttpMethod.GET, entity, Map.class);
            Map<String, Object> execBody = execResponse.getBody();

            if (execBody != null && execBody.containsKey("data")) {
                List<Map<String, Object>> executions = (List<Map<String, Object>>) execBody.get("data");

                Map<String, Instant> lastRuns = new HashMap<>();
                Map<String, Instant> lastErrors = new HashMap<>();

                for (Map<String, Object> exec : executions) {
                    String wfId = (String) exec.get("workflowId");
                    String finished = String.valueOf(exec.get("finished")); // boolean or string
                    String startedAtStr = (String) exec.get("startedAt");
                    Instant startedAt = null;
                    try {
                        if (startedAtStr != null) startedAt = Instant.parse(startedAtStr);
                    } catch (Exception ignored) {
                    }

                    if (wfId != null && startedAt != null) {
                        // Update last run if this execution is newer
                        if (!lastRuns.containsKey(wfId) || startedAt.isAfter(lastRuns.get(wfId))) {
                            lastRuns.put(wfId, startedAt);
                        }

                        // Check for error status. n8n execution object usually has "finished": false/true, "mode": "manual"/"trigger" etc.
                        // But list endpoint might not have full status.
                        // However, we can check if we can infer error.
                        // Actually, let's check if there is a 'stoppedAt' and if it failed?
                        // The list endpoint returns objects like: { id, finished, mode, retryOf, retrySuccessId, status, startedAt, stoppedAt, workflowId, waitTill }
                        // 'status' field exists in recent n8n versions: "success", "error", "waiting", "crashed", "canceled"

                        String status = (String) exec.get("status");
                        if ("error".equalsIgnoreCase(status) || "crashed".equalsIgnoreCase(status)) {
                            if (!lastErrors.containsKey(wfId) || startedAt.isAfter(lastErrors.get(wfId))) {
                                lastErrors.put(wfId, startedAt);
                            }
                        }
                    }
                }

                for (WorkflowDto wf : workflows) {
                    if (lastRuns.containsKey(wf.getId())) {
                        wf.setLastRunAt(lastRuns.get(wf.getId()));
                    }
                    if (lastErrors.containsKey(wf.getId())) {
                        wf.setLastErrorAt(lastErrors.get(wf.getId()));
                    }
                }
            }
        } catch (Exception e) {
            // Ignore execution fetch errors, just return workflows without stats
            logger.warn("Failed to fetch executions for stats: {}", e.getMessage());
        }

        // Sort by name
        workflows.sort(Comparator.comparing(WorkflowDto::getName, String.CASE_INSENSITIVE_ORDER));

        return workflows;
    }

    private WorkflowDto mapToWorkflowDto(Map<String, Object> data) {
        WorkflowDto dto = new WorkflowDto();
        dto.setId((String) data.get("id"));
        dto.setName((String) data.get("name"));
        dto.setActive(Boolean.TRUE.equals(data.get("active")));
        // Note: lastRunAt and lastErrorAt are not available in the standard /workflows endpoint
        // They would require fetching execution history which is heavier.
        return dto;
    }

    public List<EventDto> getExecutionErrors(String baseUrl, String apiKey, int limit) {
        return getExecutionErrors(baseUrl, apiKey, limit, null);
    }

    public List<EventDto> getExecutionErrors(String baseUrl, String apiKey, int limit, Instant startedAfter) {
        try {
            return fetchExecutionErrors(baseUrl, apiKey, limit, startedAfter);
        } catch (Exception e) {
            // Log error but return empty list to avoid breaking UI
            logger.warn("Failed to fetch executions from n8n: {}", e.getMessage());
            return new ArrayList<>();
        }
    }

    /** Like {@link #getExecutionErrors(String, String, int, Instant)}, but propagates request failures. */
    public List<EventDto> fetchExecutionErrors(String baseUrl, String apiKey, int limit, Instant startedAfter) {
        if (baseUrl == null || apiKey == null) {
            return Collections.emptyList();
        }

        // includeData=true makes n8n load full execution data, so keep the page small.
        int effectiveLimit = Math.min(limit, MAX_LIMIT_WITH_DATA);

        // Include data to get error details
        StringBuilder urlBuilder = new StringBuilder(baseUrl.replaceAll("/$", "") + "/api/v1/executions?status=error&includeData=true");
        if (effectiveLimit > 0) {
            urlBuilder.append("&limit=").append(effectiveLimit);
        }
        // Note: startedAfter query param is not reliably supported across n8n versions, so we filter in memory.

        HttpHeaders headers = new HttpHeaders();
        headers.set("X-N8N-API-KEY", apiKey);

        HttpEntity<Void> entity = new HttpEntity<>(headers);

        ResponseEntity<Map> response = restTemplate.exchange(urlBuilder.toString(), HttpMethod.GET, entity, Map.class);
        Map<String, Object> body = response.getBody();

        if (body != null && body.containsKey("data")) {
            List<Map<String, Object>> data = (List<Map<String, Object>>) body.get("data");
            List<EventDto> events = data.stream().map(this::mapToEventDto).toList();

            if (startedAfter != null) {
                return events.stream()
                        .filter(e -> e.getOccurredAt() != null && e.getOccurredAt().isAfter(startedAfter))
                        .toList();
            }
            return events;
        }
        return new ArrayList<>();
    }

    /**
     * Lightweight variant for diagnostics: requests {@code includeData=false} and pages through the
     * executions (newest first, cursor based) only until an execution older than {@code startedAfter}
     * shows up or {@code limit} matches are collected. Workflow names come from
     * {@code /api/v1/workflows} (cached briefly) instead of the execution data. The events carry no
     * {@code errorMessage}. Request failures are propagated.
     */
    public List<EventDto> fetchExecutionErrorSummaries(String baseUrl, String apiKey, int limit, Instant startedAfter) {
        if (baseUrl == null || apiKey == null || limit <= 0) {
            return Collections.emptyList();
        }
        String base = baseUrl.replaceAll("/$", "");
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-N8N-API-KEY", apiKey);
        HttpEntity<Void> entity = new HttpEntity<>(headers);
        int pageSize = Math.min(SUMMARY_PAGE_SIZE, limit);

        List<Map<String, Object>> matches = new ArrayList<>();
        String cursor = null;
        for (int page = 0; page < MAX_SUMMARY_PAGES && matches.size() < limit; page++) {
            String url = base + "/api/v1/executions?status=error&includeData=false&limit=" + pageSize
                    + (cursor != null ? "&cursor={cursor}" : "");
            Map<String, Object> uriVariables = cursor != null ? Map.of("cursor", cursor) : Map.of();
            ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.GET, entity, Map.class, uriVariables);
            Map<String, Object> body = response.getBody();
            if (body == null || !(body.get("data") instanceof List<?> data) || data.isEmpty()) {
                break;
            }
            boolean reachedOlder = false;
            for (Object item : data) {
                if (!(item instanceof Map<?, ?> raw)) {
                    continue;
                }
                @SuppressWarnings("unchecked")
                Map<String, Object> execution = (Map<String, Object>) raw;
                Instant started = parseInstant(execution.get("startedAt"));
                if (started == null) {
                    continue;
                }
                if (startedAfter != null && !started.isAfter(startedAfter)) {
                    reachedOlder = true;
                    continue;
                }
                matches.add(execution);
            }
            Object next = body.get("nextCursor");
            cursor = next instanceof String s && !s.isBlank() ? s : null;
            if (reachedOlder || cursor == null) {
                break;
            }
        }

        if (matches.isEmpty()) {
            return new ArrayList<>();
        }
        Map<String, String> names = workflowNames(base, apiKey, entity);
        List<EventDto> events = new ArrayList<>();
        for (Map<String, Object> execution : matches.subList(0, Math.min(limit, matches.size()))) {
            EventDto dto = new EventDto();
            dto.setId(String.valueOf(execution.get("id")));
            dto.setEventType("WORKFLOW_ERROR");
            dto.setSeverity("ERROR");
            dto.setOccurredAt(parseInstant(execution.get("startedAt")));
            String workflowId = execution.get("workflowId") != null ? String.valueOf(execution.get("workflowId")) : null;
            String workflowName = workflowId == null ? "Unknown Workflow"
                    : names.getOrDefault(workflowId, "Workflow " + workflowId);
            dto.setPayload(Map.of(
                    "workflowId", workflowId != null ? workflowId : "unknown",
                    "workflowName", workflowName,
                    "executionId", dto.getId()));
            events.add(dto);
        }
        return events;
    }

    private static Instant parseInstant(Object value) {
        if (!(value instanceof String text)) {
            return null;
        }
        try {
            return Instant.parse(text);
        } catch (Exception e) {
            return null;
        }
    }

    /** Workflow id to name; cached per instance for a few minutes. Failures yield an empty map (names fall back to ids). */
    private Map<String, String> workflowNames(String base, String apiKey, HttpEntity<Void> entity) {
        NameKey key = new NameKey(base, apiKey);
        Instant now = Instant.now();
        CachedNames cached = workflowNameCache.get(key);
        if (cached != null && cached.expiresAt().isAfter(now)) {
            return cached.names();
        }
        Map<String, String> names = new HashMap<>();
        try {
            String cursor = null;
            for (int page = 0; page < MAX_WORKFLOW_PAGES; page++) {
                String url = base + "/api/v1/workflows?limit=" + WORKFLOW_PAGE_SIZE
                        + (cursor != null ? "&cursor={cursor}" : "");
                Map<String, Object> uriVariables = cursor != null ? Map.of("cursor", cursor) : Map.of();
                ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.GET, entity, Map.class, uriVariables);
                Map<String, Object> body = response.getBody();
                if (body == null) {
                    break;
                }
                if (body.get("data") instanceof List<?> data) {
                    for (Object item : data) {
                        if (item instanceof Map<?, ?> wf && wf.get("id") != null && wf.get("name") != null) {
                            names.put(String.valueOf(wf.get("id")), String.valueOf(wf.get("name")));
                        }
                    }
                }
                Object next = body.get("nextCursor");
                cursor = next instanceof String s && !s.isBlank() ? s : null;
                if (cursor == null) {
                    break;
                }
            }
        } catch (Exception e) {
            logger.warn("Could not resolve workflow names: {}", e.getMessage());
            return names;
        }
        workflowNameCache.values().removeIf(entry -> !entry.expiresAt().isAfter(now));
        workflowNameCache.put(key, new CachedNames(names, now.plus(WORKFLOW_NAME_TTL)));
        return names;
    }

    private EventDto mapToEventDto(Map<String, Object> data) {
        EventDto dto = new EventDto();
        dto.setId((String) data.get("id"));
        dto.setEventType("WORKFLOW_ERROR");
        dto.setSeverity("ERROR");

        String startedAt = (String) data.get("startedAt");
        if (startedAt != null) {
            try {
                dto.setOccurredAt(Instant.parse(startedAt));
            } catch (Exception e) {
                dto.setOccurredAt(Instant.now());
            }
        } else {
            dto.setOccurredAt(Instant.now());
        }

        Map<String, Object> workflowData = (Map<String, Object>) data.get("workflowData");
        String workflowId = (String) data.get("workflowId");
        String workflowName = "Unknown Workflow";

        if (workflowData != null && workflowData.get("name") != null) {
            workflowName = (String) workflowData.get("name");
        } else if (data.get("workflowName") != null) {
            workflowName = (String) data.get("workflowName");
        } else if (workflowId != null) {
            workflowName = "Workflow " + workflowId;
        }

        String errorMessage = "Execution failed";

        // Strategy 1: Check top-level resultData
        if (data.get("resultData") instanceof Map) {
            String extracted = extractErrorFromResultData((Map<String, Object>) data.get("resultData"));
            if (extracted != null) errorMessage = extracted;
        }

        // Strategy 2: Check data.resultData (nested)
        if ("Execution failed".equals(errorMessage) && data.get("data") instanceof Map) {
            Map<String, Object> innerData = (Map<String, Object>) data.get("data");
            if (innerData.get("resultData") instanceof Map) {
                String extracted = extractErrorFromResultData((Map<String, Object>) innerData.get("resultData"));
                if (extracted != null) errorMessage = extracted;
            }
        }

        // Debug log to help identify structure if still failing
        if ("Execution failed".equals(errorMessage)) {
            logger.debug("Could not extract error message for execution {}; data keys: {}, inner data keys: {}",
                    dto.getId(), data.keySet(),
                    data.get("data") instanceof Map ? ((Map<?, ?>) data.get("data")).keySet() : "n/a");
        }

        dto.setPayload(Map.of(
                "workflowId", workflowId != null ? workflowId : "unknown",
                "workflowName", workflowName,
                "errorMessage", errorMessage,
                "executionId", dto.getId()
        ));

        return dto;
    }

    private String extractErrorFromResultData(Map<String, Object> resultData) {
        if (resultData.containsKey("error")) {
            Object errorObj = resultData.get("error");
            if (errorObj instanceof Map) {
                Map<String, Object> error = (Map<String, Object>) errorObj;
                if (error.get("message") != null) {
                    return (String) error.get("message");
                }
            } else if (errorObj instanceof String) {
                return (String) errorObj;
            }
        }
        if (resultData.containsKey("message")) {
            return (String) resultData.get("message");
        }
        return null;
    }

    public record SystemInfo(String status, String version) {
    }
}
