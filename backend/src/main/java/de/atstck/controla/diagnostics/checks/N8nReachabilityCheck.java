package de.atstck.controla.diagnostics.checks;

import de.atstck.controla.diagnostics.DiagnosticCategory;
import de.atstck.controla.diagnostics.DiagnosticCheck;
import de.atstck.controla.diagnostics.DiagnosticContext;
import de.atstck.controla.diagnostics.DiagnosticResult;
import de.atstck.controla.diagnostics.HttpProbe;
import de.atstck.controla.security.InstanceTargetPolicy;
import de.atstck.controla.security.TargetNotAllowedException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;

/** DNS resolution and an HTTP request to the base URL. */
@Component
public class N8nReachabilityCheck implements DiagnosticCheck {

    private final HttpProbe probe;
    private final InstanceTargetPolicy policy;
    private final long slowThresholdMs;

    public N8nReachabilityCheck(HttpProbe probe, InstanceTargetPolicy policy,
                                @Value("${controla.diagnostics.slow-response-ms:2000}") long slowThresholdMs) {
        this.probe = probe;
        this.policy = policy;
        this.slowThresholdMs = slowThresholdMs;
    }

    @Override
    public String id() {
        return "n8n.reachability";
    }

    @Override
    public DiagnosticCategory category() {
        return DiagnosticCategory.CONNECTIVITY;
    }

    @Override
    public String title() {
        return "Erreichbarkeit der Basis-URL";
    }

    @Override
    public int order() {
        return 10;
    }

    @Override
    public DiagnosticResult run(DiagnosticContext context) {
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("baseUrl", context.baseUrl());
        String host;
        try {
            URI uri = URI.create(context.baseUrl());
            host = uri.getHost();
            if (host == null || uri.getScheme() == null || !uri.getScheme().matches("https?")) {
                throw new IllegalArgumentException("missing scheme or host");
            }
        } catch (RuntimeException e) {
            return DiagnosticResult.of(this).details(details)
                    .hint("Basis-URL in den Instanz-Einstellungen prüfen, z. B. https://n8n.example.com")
                    .fail("Die Basis-URL ist ungültig.");
        }

        try {
            InetAddress[] addresses = policy.resolveAllowed(host);
            details.put("addresses", Arrays.stream(addresses).map(InetAddress::getHostAddress).toList());
        } catch (TargetNotAllowedException e) {
            return DiagnosticResult.of(this).details(details)
                    .hint("Die Instanz muss über eine öffentliche Adresse erreichbar sein.")
                    .fail(HttpProbe.describe(HttpProbe.Failure.NOT_ALLOWED));
        } catch (UnknownHostException e) {
            return DiagnosticResult.of(this).details(details)
                    .hint("Hostnamen und DNS-Eintrag prüfen.")
                    .fail("Der Hostname '" + host + "' lässt sich nicht auflösen (DNS).");
        }

        HttpProbe.Result result = probe.get(context.baseUrl(), Map.of());
        details.put("latencyMs", result.latencyMs());
        if (!result.responded()) {
            details.put("error", result.errorMessage());
            return DiagnosticResult.of(this).details(details)
                    .hint(hintFor(result.failure()))
                    .fail(HttpProbe.describe(result.failure()));
        }

        int status = result.httpStatus();
        details.put("httpStatus", status);
        if (status == 502 || status == 503 || status == 504) {
            return DiagnosticResult.of(this).details(details)
                    .hint("Der Reverse-Proxy antwortet, erreicht n8n aber nicht: läuft der n8n-Container, stimmt das Upstream-Ziel im Proxy?")
                    .fail("Der Proxy antwortet mit HTTP " + status + ", n8n dahinter antwortet nicht.");
        }
        if (status >= 500) {
            return DiagnosticResult.of(this).details(details)
                    .hint("n8n-Logs prüfen.")
                    .warn("Der Server antwortet mit HTTP " + status + ".");
        }
        if (result.latencyMs() > slowThresholdMs) {
            return DiagnosticResult.of(this).details(details)
                    .hint("Auslastung des Hosts bzw. Netzwerkpfad prüfen.")
                    .warn("Erreichbar, aber langsam (" + result.latencyMs() + " ms).");
        }
        return DiagnosticResult.of(this).details(details)
                .ok("Erreichbar (HTTP " + status + ", " + result.latencyMs() + " ms).");
    }

    private static String hintFor(HttpProbe.Failure failure) {
        return switch (failure) {
            case REFUSED -> "Läuft n8n bzw. der Reverse-Proxy? Stimmen Port und Port-Mapping?";
            case TIMEOUT, UNREACHABLE -> "Firewall, Security-Groups und Netzwerkpfad zum Host prüfen.";
            case TLS -> "Siehe Prüfung „TLS-Zertifikat“.";
            case NOT_ALLOWED -> "Die Instanz muss über eine öffentliche Adresse erreichbar sein.";
            default -> "Basis-URL und Netzwerk prüfen.";
        };
    }
}
