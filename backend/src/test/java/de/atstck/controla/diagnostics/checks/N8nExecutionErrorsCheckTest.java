package de.atstck.controla.diagnostics.checks;

import de.atstck.controla.diagnostics.DiagnosticContext;
import de.atstck.controla.diagnostics.DiagnosticResult;
import de.atstck.controla.diagnostics.DiagnosticStatus;
import de.atstck.controla.dto.EventDto;
import de.atstck.controla.instance.Instance;
import de.atstck.controla.service.N8nApiClient;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;

class N8nExecutionErrorsCheckTest {

    private static final Instant NOW = Instant.parse("2026-10-14T12:00:00Z");
    private final N8nApiClient client = mock(N8nApiClient.class);
    private final N8nExecutionErrorsCheck check = new N8nExecutionErrorsCheck(client, 3, Clock.fixed(NOW, ZoneOffset.UTC));

    private static DiagnosticContext context(String apiKey) {
        Instance instance = new Instance();
        instance.setBaseUrl("https://n8n.example.com");
        return new DiagnosticContext(instance, () -> apiKey, "t", NOW);
    }

    private static EventDto error(String workflow) {
        EventDto dto = new EventDto();
        dto.setPayload(Map.of("workflowName", workflow));
        return dto;
    }

    @Test
    void warnsFromThresholdAndListsTopWorkflows() {
        List<EventDto> errors = new ArrayList<>(List.of(error("A"), error("B"), error("A")));
        when(client.fetchExecutionErrors(eq("https://n8n.example.com"), eq("key"), eq(250), eq(NOW.minusSeconds(86400))))
                .thenReturn(errors);

        DiagnosticResult result = check.run(context("key"));

        assertThat(result.status()).isEqualTo(DiagnosticStatus.WARN);
        assertThat(result.details()).containsEntry("count", 3);
        assertThat((List<?>) result.details().get("topWorkflows")).first()
                .isEqualTo(Map.of("workflow", "A", "count", 2L));
    }

    @Test
    void okBelowThresholdAndWithoutErrors() {
        when(client.fetchExecutionErrors(anyString(), anyString(), anyInt(), any())).thenReturn(List.of(error("A")));
        assertThat(check.run(context("key")).status()).isEqualTo(DiagnosticStatus.OK);

        when(client.fetchExecutionErrors(anyString(), anyString(), anyInt(), any())).thenReturn(List.of());
        assertThat(check.run(context("key")).summary()).contains("Keine");
    }

    @Test
    void skippedWithoutApiKey() {
        assertThat(check.run(context(null)).status()).isEqualTo(DiagnosticStatus.SKIPPED);
        verify(client, never()).fetchExecutionErrors(any(), any(), anyInt(), any());
    }
}
