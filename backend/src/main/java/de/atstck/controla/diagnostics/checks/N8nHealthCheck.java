package de.atstck.controla.diagnostics.checks;

import de.atstck.controla.diagnostics.DiagnosticCategory;
import de.atstck.controla.diagnostics.DiagnosticCheck;
import de.atstck.controla.diagnostics.DiagnosticContext;
import de.atstck.controla.diagnostics.DiagnosticResult;
import de.atstck.controla.diagnostics.HttpProbe;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

/** {@code GET /healthz}: n8n process responds. */
@Component
public class N8nHealthCheck implements DiagnosticCheck {

    private final HttpProbe probe;

    public N8nHealthCheck(HttpProbe probe) {
        this.probe = probe;
    }

    @Override
    public String id() {
        return "n8n.health";
    }

    @Override
    public DiagnosticCategory category() {
        return DiagnosticCategory.N8N;
    }

    @Override
    public String title() {
        return "n8n-Health (/healthz)";
    }

    @Override
    public int order() {
        return 10;
    }

    @Override
    public DiagnosticResult run(DiagnosticContext context) {
        HttpProbe.Result result = probe.get(HttpProbeUrls.join(context.baseUrl(), "/healthz"), Map.of());
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("latencyMs", result.latencyMs());
        if (!result.responded()) {
            details.put("error", result.errorMessage());
            return DiagnosticResult.of(this).details(details).fail(HttpProbe.describe(result.failure()));
        }
        details.put("httpStatus", result.httpStatus());
        int status = result.httpStatus();
        if (status == 200) {
            return DiagnosticResult.of(this).details(details).ok("n8n meldet sich gesund.");
        }
        if (status == 404) {
            return DiagnosticResult.of(this).details(details)
                    .hint("Falls der Health-Pfad umkonfiguriert ist (N8N_ENDPOINT_HEALTH), ist das erwartbar.")
                    .skipped("Kein Health-Endpunkt unter /healthz gefunden.");
        }
        if (status >= 300 && status < 400) {
            details.put("location", result.location());
            return DiagnosticResult.of(this).details(details)
                    .hint("Die Basis-URL sollte direkt auf n8n zeigen (ohne Weiterleitung, z. B. https statt http).")
                    .warn("/healthz leitet weiter (HTTP " + status + ").");
        }
        return DiagnosticResult.of(this).details(details)
                .hint("n8n-Logs prüfen.")
                .fail("/healthz antwortet mit HTTP " + status + ".");
    }
}
