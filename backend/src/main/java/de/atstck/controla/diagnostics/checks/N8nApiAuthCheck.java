package de.atstck.controla.diagnostics.checks;

import de.atstck.controla.diagnostics.DiagnosticCategory;
import de.atstck.controla.diagnostics.DiagnosticCheck;
import de.atstck.controla.diagnostics.DiagnosticContext;
import de.atstck.controla.diagnostics.DiagnosticResult;
import de.atstck.controla.diagnostics.HttpProbe;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Authenticated request against the n8n public API. Redirects are not
 * followed, so the API key is only ever sent to the configured base URL.
 */
@Component
public class N8nApiAuthCheck implements DiagnosticCheck {

    private final HttpProbe probe;

    public N8nApiAuthCheck(HttpProbe probe) {
        this.probe = probe;
    }

    @Override
    public String id() {
        return "n8n.api-auth";
    }

    @Override
    public DiagnosticCategory category() {
        return DiagnosticCategory.N8N;
    }

    @Override
    public String title() {
        return "API-Zugriff (API-Key)";
    }

    @Override
    public int order() {
        return 30;
    }

    @Override
    public DiagnosticResult run(DiagnosticContext context) {
        String apiKey = context.apiKey();
        if (apiKey == null || apiKey.isBlank()) {
            return DiagnosticResult.of(this)
                    .hint("API-Key in den Instanz-Einstellungen neu hinterlegen.")
                    .fail("Für die Instanz ist kein lesbarer API-Key gespeichert.");
        }
        HttpProbe.Result result = probe.get(
                HttpProbeUrls.join(context.baseUrl(), "/api/v1/workflows?limit=1"),
                Map.of("X-N8N-API-KEY", apiKey, "Accept", "application/json"));
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("latencyMs", result.latencyMs());
        if (!result.responded()) {
            details.put("error", result.errorMessage());
            return DiagnosticResult.of(this).details(details).fail(HttpProbe.describe(result.failure()));
        }
        int status = result.httpStatus();
        details.put("httpStatus", status);
        if (status == 200) {
            return DiagnosticResult.of(this).details(details).ok("Der API-Key ist gültig.");
        }
        if (status == 401 || status == 403) {
            return DiagnosticResult.of(this).details(details)
                    .hint("In n8n unter Settings → n8n API einen neuen Key erzeugen und in Controla hinterlegen.")
                    .fail("Der API-Key wird abgelehnt (HTTP " + status + ") – ungültig oder abgelaufen.");
        }
        if (status == 404) {
            return DiagnosticResult.of(this).details(details)
                    .hint("Prüfen, ob N8N_PUBLIC_API_DISABLED gesetzt ist bzw. die Basis-URL auf n8n zeigt.")
                    .fail("Die n8n Public API ist nicht erreichbar (HTTP 404).");
        }
        if (status >= 300 && status < 400) {
            details.put("location", result.location());
            return DiagnosticResult.of(this).details(details)
                    .hint("Basis-URL auf das Weiterleitungsziel ändern; der API-Key wird an Weiterleitungen nicht mitgesendet.")
                    .warn("Die API leitet weiter (HTTP " + status + ").");
        }
        return DiagnosticResult.of(this).details(details)
                .warn("Die API antwortet mit HTTP " + status + ".");
    }
}
