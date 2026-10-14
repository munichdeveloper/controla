package de.atstck.controla.diagnostics.checks;

import de.atstck.controla.diagnostics.DiagnosticCategory;
import de.atstck.controla.diagnostics.DiagnosticCheck;
import de.atstck.controla.diagnostics.DiagnosticContext;
import de.atstck.controla.diagnostics.DiagnosticResult;
import de.atstck.controla.security.InstanceTargetPolicy;
import de.atstck.controla.security.TargetNotAllowedException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.net.ssl.SNIHostName;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLHandshakeException;
import javax.net.ssl.SSLParameters;
import javax.net.ssl.SSLSocket;
import javax.net.ssl.SSLSocketFactory;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.URI;
import java.security.cert.Certificate;
import java.security.cert.X509Certificate;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Certificate chain, host name and expiry of HTTPS base URLs. Only a TLS
 * handshake is performed; no HTTP request and no API key are sent.
 */
@Component
public class N8nTlsCheck implements DiagnosticCheck {

    private static final int TIMEOUT_MS = 5000;

    private final InstanceTargetPolicy policy;
    private final long warnDays;
    private final Clock clock;

    @Autowired
    public N8nTlsCheck(InstanceTargetPolicy policy,
                       @Value("${controla.diagnostics.tls-warn-days:14}") long warnDays) {
        this(policy, warnDays, Clock.systemUTC());
    }

    N8nTlsCheck(InstanceTargetPolicy policy, long warnDays, Clock clock) {
        this.policy = policy;
        this.warnDays = warnDays;
        this.clock = clock;
    }

    @Override
    public String id() {
        return "n8n.tls";
    }

    @Override
    public DiagnosticCategory category() {
        return DiagnosticCategory.CONNECTIVITY;
    }

    @Override
    public String title() {
        return "TLS-Zertifikat";
    }

    @Override
    public int order() {
        return 20;
    }

    @Override
    public boolean appliesTo(DiagnosticContext context) {
        try {
            URI uri = URI.create(context.baseUrl());
            return "https".equalsIgnoreCase(uri.getScheme()) && uri.getHost() != null;
        } catch (RuntimeException e) {
            return false;
        }
    }

    @Override
    public DiagnosticResult run(DiagnosticContext context) throws Exception {
        URI uri = URI.create(context.baseUrl());
        String host = uri.getHost();
        int port = uri.getPort() > 0 ? uri.getPort() : 443;
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("host", host);
        details.put("port", port);

        InetAddress address;
        try {
            address = policy.resolveAllowed(host)[0];
        } catch (TargetNotAllowedException e) {
            return DiagnosticResult.of(this).details(details).skipped("Zieladresse in dieser Umgebung nicht erlaubt.");
        } catch (java.net.UnknownHostException e) {
            return DiagnosticResult.of(this).details(details).skipped("Hostname nicht auflösbar – siehe Erreichbarkeit.");
        }

        String validationError = null;
        try {
            handshake(address, host, port, (SSLSocketFactory) SSLSocketFactory.getDefault(), true);
        } catch (SSLHandshakeException e) {
            validationError = e.getMessage();
        } catch (java.io.IOException e) {
            return DiagnosticResult.of(this).details(details)
                    .skipped("Keine TLS-Verbindung möglich: " + e.getMessage());
        }

        // Read the presented certificate even if it is invalid (handshake only, nothing is sent).
        X509Certificate leaf = null;
        try {
            Certificate[] chain = handshake(address, host, port, trustAllFactory(), false);
            if (chain.length > 0 && chain[0] instanceof X509Certificate x509) {
                leaf = x509;
            }
        } catch (Exception e) {
            details.put("certificateReadError", e.getMessage());
        }

        Long daysLeft = null;
        if (leaf != null) {
            details.put("subject", leaf.getSubjectX500Principal().getName());
            details.put("issuer", leaf.getIssuerX500Principal().getName());
            details.put("notAfter", leaf.getNotAfter().toInstant().toString());
            daysLeft = Duration.between(Instant.now(clock), leaf.getNotAfter().toInstant()).toDays();
            details.put("daysLeft", daysLeft);
        }

        if (validationError != null) {
            details.put("validationError", validationError);
            return DiagnosticResult.of(this).details(details)
                    .hint(hintFor(validationError))
                    .fail("Das Zertifikat ist ungültig: " + shortReason(validationError));
        }
        if (daysLeft != null && daysLeft < warnDays) {
            return DiagnosticResult.of(this).details(details)
                    .hint("Zertifikat erneuern bzw. die automatische Erneuerung (z. B. Let's Encrypt) prüfen.")
                    .warn("Das Zertifikat läuft in " + daysLeft + " Tagen ab.");
        }
        return DiagnosticResult.of(this).details(details)
                .ok(daysLeft != null ? "Gültig, noch " + daysLeft + " Tage." : "Gültig.");
    }

    private static Certificate[] handshake(InetAddress address, String host, int port, SSLSocketFactory factory,
                                           boolean verifyHostname) throws java.io.IOException {
        try (Socket plain = new Socket()) {
            plain.connect(new InetSocketAddress(address, port), TIMEOUT_MS);
            plain.setSoTimeout(TIMEOUT_MS);
            try (SSLSocket socket = (SSLSocket) factory.createSocket(plain, host, port, false)) {
                SSLParameters parameters = socket.getSSLParameters();
                parameters.setServerNames(List.of(new SNIHostName(host)));
                if (verifyHostname) {
                    parameters.setEndpointIdentificationAlgorithm("HTTPS");
                }
                socket.setSSLParameters(parameters);
                socket.startHandshake();
                return socket.getSession().getPeerCertificates();
            }
        }
    }

    private static SSLSocketFactory trustAllFactory() throws Exception {
        TrustManager[] trustAll = {new X509TrustManager() {
            @Override
            public void checkClientTrusted(X509Certificate[] chain, String authType) {
            }

            @Override
            public void checkServerTrusted(X509Certificate[] chain, String authType) {
            }

            @Override
            public X509Certificate[] getAcceptedIssuers() {
                return new X509Certificate[0];
            }
        }};
        SSLContext context = SSLContext.getInstance("TLS");
        context.init(null, trustAll, null);
        return context.getSocketFactory();
    }

    private static String shortReason(String message) {
        String m = message == null ? "" : message.toLowerCase();
        if (m.contains("expired") || m.contains("notafter")) return "abgelaufen";
        if (m.contains("no subject alternative") || m.contains("no name matching")) return "Hostname passt nicht zum Zertifikat";
        if (m.contains("pkix") || m.contains("unable to find valid certification path")) return "nicht vertrauenswürdige Zertifizierungsstelle (z. B. selbstsigniert)";
        return message;
    }

    private static String hintFor(String message) {
        String reason = shortReason(message);
        if (reason.equals("abgelaufen")) return "Zertifikat erneuern.";
        if (reason.startsWith("Hostname")) return "Zertifikat für den in der Basis-URL verwendeten Hostnamen ausstellen.";
        if (reason.startsWith("nicht vertrauenswürdige")) return "Zertifikat einer öffentlichen CA verwenden (z. B. Let's Encrypt) oder die Zwischenzertifikate mit ausliefern.";
        return "Zertifikat und TLS-Konfiguration des Reverse-Proxys prüfen.";
    }
}
