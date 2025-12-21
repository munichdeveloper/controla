package de.dgtlschmd.n8n.service;

import de.dgtlschmd.n8n.dto.EventDto;
import de.dgtlschmd.n8n.dto.WorkflowDto;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class N8nApiClient {
    private final RestTemplate restTemplate;
    private String cachedLatestVersion;
    private long lastVersionCheck = 0;
    private static final long VERSION_CHECK_INTERVAL = 3600000; // 1 hour

    public N8nApiClient(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
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
            System.err.println("Failed to fetch executions for stats: " + e.getMessage());
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
        if (baseUrl == null || apiKey == null) {
            return Collections.emptyList();
        }

        // n8n API max limit is 250
        int effectiveLimit = Math.min(limit, 250);

        // Include data to get error details
        StringBuilder urlBuilder = new StringBuilder(baseUrl.replaceAll("/$", "") + "/api/v1/executions?status=error&includeData=true");
        if (effectiveLimit > 0) {
            urlBuilder.append("&limit=").append(effectiveLimit);
        }
        // Note: startedAfter query param is not reliably supported across n8n versions, so we filter in memory.

        HttpHeaders headers = new HttpHeaders();
        headers.set("X-N8N-API-KEY", apiKey);

        HttpEntity<Void> entity = new HttpEntity<>(headers);

        try {
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
        } catch (Exception e) {
            // Log error but return empty list to avoid breaking UI
            System.err.println("Failed to fetch executions from n8n: " + e.getMessage());
        }
        return new ArrayList<>();
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
            System.out.println("Could not extract error message for execution " + dto.getId());
            System.out.println("Data keys: " + data.keySet());
            if (data.get("data") instanceof Map) {
                System.out.println("inner data keys: " + ((Map) data.get("data")).keySet());
            }
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
