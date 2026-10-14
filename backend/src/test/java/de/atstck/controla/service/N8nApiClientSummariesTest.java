package de.atstck.controla.service;

import de.atstck.controla.dto.EventDto;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class N8nApiClientSummariesTest {

    private static final Instant NOW = Instant.parse("2026-10-14T12:00:00Z");

    private final RestTemplate restTemplate = mock(RestTemplate.class);
    private final N8nApiClient client = new N8nApiClient(clientFor(restTemplate));

    private static InstanceHttpClient clientFor(RestTemplate restTemplate) {
        InstanceHttpClient http = mock(InstanceHttpClient.class);
        when(http.restTemplate()).thenReturn(restTemplate);
        return http;
    }

    private static Map<String, Object> execution(int id, Instant startedAt) {
        return Map.of("id", String.valueOf(id), "workflowId", "wf1", "startedAt", startedAt.toString());
    }

    private void stubWorkflows() {
        when(restTemplate.exchange(contains("/api/v1/workflows"), eq(HttpMethod.GET), any(HttpEntity.class),
                eq(Map.class), anyMap()))
                .thenReturn(ResponseEntity.ok(Map.of("data", List.of(Map.of("id", "wf1", "name", "Mein Workflow")))));
    }

    private void stubExecutions(Map<String, Object> body) {
        when(restTemplate.exchange(contains("/api/v1/executions"), eq(HttpMethod.GET), any(HttpEntity.class),
                eq(Map.class), anyMap())).thenReturn(ResponseEntity.ok(body));
    }

    @Test
    void requestsNoExecutionDataAndResolvesWorkflowNames() {
        stubWorkflows();
        stubExecutions(Map.of("data", List.of(execution(2, NOW.minusSeconds(60)))));

        List<EventDto> events = client.fetchExecutionErrorSummaries(
                "https://n8n.example.com/", "key", 250, NOW.minusSeconds(86400));

        ArgumentCaptor<String> urls = ArgumentCaptor.forClass(String.class);
        verify(restTemplate, org.mockito.Mockito.atLeastOnce())
                .exchange(urls.capture(), eq(HttpMethod.GET), any(HttpEntity.class), eq(Map.class), anyMap());
        String executionsUrl = urls.getAllValues().stream().filter(u -> u.contains("/executions")).findFirst().orElseThrow();
        assertThat(executionsUrl).isEqualTo(
                "https://n8n.example.com/api/v1/executions?status=error&includeData=false&limit=100");
        assertThat(urls.getAllValues()).noneMatch(u -> u.contains("includeData=true"));
        assertThat(events).hasSize(1);
        assertThat(events.get(0).getPayload()).containsEntry("workflowName", "Mein Workflow");
    }

    @Test
    void stopsPagingAtFirstExecutionOlderThanTheWindow() {
        stubWorkflows();
        List<Object> page = new ArrayList<>();
        page.add(execution(3, NOW.minusSeconds(60)));
        page.add(execution(2, NOW.minusSeconds(86400 + 60)));
        stubExecutions(Map.of("data", page, "nextCursor", "next"));

        List<EventDto> events = client.fetchExecutionErrorSummaries(
                "https://n8n.example.com", "key", 250, NOW.minusSeconds(86400));

        assertThat(events).hasSize(1);
        verify(restTemplate, org.mockito.Mockito.times(1))
                .exchange(contains("/api/v1/executions"), eq(HttpMethod.GET), any(HttpEntity.class), eq(Map.class), anyMap());
    }

    @Test
    void limitIsReachedWithoutLoadingMoreThanNeeded() {
        stubWorkflows();
        List<Object> page = new ArrayList<>();
        for (int i = 0; i < 100; i++) {
            page.add(execution(i, NOW.minusSeconds(60)));
        }
        stubExecutions(Map.of("data", page, "nextCursor", "next"));

        List<EventDto> events = client.fetchExecutionErrorSummaries(
                "https://n8n.example.com", "key", 250, NOW.minusSeconds(86400));

        assertThat(events).hasSize(250);
    }

    @Test
    void noRequestWithoutApiKey() {
        assertThat(client.fetchExecutionErrorSummaries("https://n8n.example.com", null, 250, NOW)).isEmpty();
        verify(restTemplate, never()).exchange(any(String.class), any(HttpMethod.class), any(HttpEntity.class),
                eq(Map.class), anyMap());
    }
}
