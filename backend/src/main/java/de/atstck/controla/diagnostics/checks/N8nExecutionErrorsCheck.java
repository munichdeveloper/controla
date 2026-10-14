package de.atstck.controla.diagnostics.checks;

import de.atstck.controla.diagnostics.DiagnosticCategory;
import de.atstck.controla.diagnostics.DiagnosticCheck;
import de.atstck.controla.diagnostics.DiagnosticContext;
import de.atstck.controla.diagnostics.DiagnosticResult;
import de.atstck.controla.dto.EventDto;
import de.atstck.controla.service.N8nApiClient;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Failed workflow executions within the last 24 hours. */
@Component
public class N8nExecutionErrorsCheck implements DiagnosticCheck {

    private final N8nApiClient n8nApiClient;
    private final int warnThreshold;
    private final Clock clock;

    @Autowired
    public N8nExecutionErrorsCheck(N8nApiClient n8nApiClient,
                                   @Value("${controla.diagnostics.execution-error-warn-threshold:10}") int warnThreshold) {
        this(n8nApiClient, warnThreshold, Clock.systemUTC());
    }

    N8nExecutionErrorsCheck(N8nApiClient n8nApiClient, int warnThreshold, Clock clock) {
        this.n8nApiClient = n8nApiClient;
        this.warnThreshold = warnThreshold;
        this.clock = clock;
    }

    @Override
    public String id() {
        return "n8n.execution-errors";
    }

    @Override
    public DiagnosticCategory category() {
        return DiagnosticCategory.WORKFLOWS;
    }

    @Override
    public String title() {
        return "Fehlgeschlagene Ausführungen (24 h)";
    }

    @Override
    public int order() {
        return 10;
    }

    @Override
    public DiagnosticResult run(DiagnosticContext context) {
        String apiKey = context.apiKey();
        if (apiKey == null || apiKey.isBlank()) {
            return DiagnosticResult.of(this).skipped("Ohne gültigen API-Key nicht prüfbar.");
        }
        List<EventDto> errors = n8nApiClient.fetchExecutionErrors(
                context.baseUrl(), apiKey, 250, clock.instant().minus(Duration.ofHours(24)));

        Map<String, Long> byWorkflow = errors.stream()
                .map(e -> String.valueOf(e.getPayload() != null ? e.getPayload().getOrDefault("workflowName", "Unbekannt") : "Unbekannt"))
                .collect(Collectors.groupingBy(Function.identity(), Collectors.counting()));
        List<Map<String, Object>> top = byWorkflow.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .limit(5)
                .map(e -> Map.<String, Object>of("workflow", e.getKey(), "count", e.getValue()))
                .toList();

        Map<String, Object> details = new LinkedHashMap<>();
        details.put("count", errors.size());
        details.put("topWorkflows", top);
        details.put("limitReached", errors.size() >= 250);

        if (errors.isEmpty()) {
            return DiagnosticResult.of(this).details(details).ok("Keine fehlgeschlagenen Ausführungen in den letzten 24 Stunden.");
        }
        String summary = errors.size() + (errors.size() >= 250 ? "+" : "") + " fehlgeschlagene Ausführung(en) in den letzten 24 Stunden.";
        if (errors.size() >= warnThreshold) {
            return DiagnosticResult.of(this).details(details)
                    .hint("Details im Tab „Fehler“ bzw. „Fehlermuster“.")
                    .warn(summary);
        }
        return DiagnosticResult.of(this).details(details).ok(summary);
    }
}
