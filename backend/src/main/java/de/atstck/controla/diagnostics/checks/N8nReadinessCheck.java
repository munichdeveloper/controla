package de.atstck.controla.diagnostics.checks;

import de.atstck.controla.diagnostics.DiagnosticCategory;
import de.atstck.controla.diagnostics.DiagnosticCheck;
import de.atstck.controla.diagnostics.DiagnosticContext;
import de.atstck.controla.diagnostics.DiagnosticResult;
import de.atstck.controla.diagnostics.HttpProbe;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

/** {@code GET /healthz/readiness}: database connected and migrated. */
@Component
public class N8nReadinessCheck implements DiagnosticCheck {

    private final HttpProbe probe;

    public N8nReadinessCheck(HttpProbe probe) {
        this.probe = probe;
    }

    @Override
    public String id() {
        return "n8n.readiness";
    }

    @Override
    public DiagnosticCategory category() {
        return DiagnosticCategory.N8N;
    }

    @Override
    public String title() {
        return "n8n-Bereitschaft (Datenbank)";
    }

    @Override
    public int order() {
        return 20;
    }

    @Override
    public DiagnosticResult run(DiagnosticContext context) {
        HttpProbe.Result result = probe.get(HttpProbeUrls.join(context.baseUrl(), "/healthz/readiness"), Map.of());
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("latencyMs", result.latencyMs());
        if (!result.responded()) {
            details.put("error", result.errorMessage());
            return DiagnosticResult.of(this).details(details).fail(HttpProbe.describe(result.failure()));
        }
        int status = result.httpStatus();
        details.put("httpStatus", status);
        if (status == 200) {
            return DiagnosticResult.of(this).details(details).ok("Datenbank verbunden, n8n ist bereit.");
        }
        if (status == 503) {
            return DiagnosticResult.of(this).details(details)
                    .hint("Datenbank-Verbindung (DB_* Variablen) und laufende Migrationen prüfen; ggf. ist der Datenbank-Container gestoppt.")
                    .fail("n8n ist nicht bereit: Datenbank nicht verbunden oder Migrationen laufen noch.");
        }
        if (status == 404) {
            return DiagnosticResult.of(this).details(details)
                    .skipped("Ältere n8n-Version ohne /healthz/readiness.");
        }
        return DiagnosticResult.of(this).details(details)
                .warn("/healthz/readiness antwortet mit HTTP " + status + ".");
    }
}
