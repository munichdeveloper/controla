package de.atstck.controla.diagnostics;

import de.atstck.controla.security.TargetNotAllowedException;
import de.atstck.controla.service.InstanceHttpClient;
import org.apache.hc.client5.http.ConnectTimeoutException;
import org.apache.hc.client5.http.HttpHostConnectException;
import org.apache.hc.client5.http.classic.methods.HttpGet;
import org.apache.hc.core5.http.io.entity.EntityUtils;
import org.springframework.stereotype.Component;

import javax.net.ssl.SSLException;
import java.io.IOException;
import java.net.NoRouteToHostException;
import java.net.SocketTimeoutException;
import java.net.URI;
import java.net.UnknownHostException;
import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * Single GET request for diagnostics: no redirects, no retries, short
 * timeouts, target policy applied. Failures are classified instead of thrown.
 */
@Component
public class HttpProbe {

    private static final int MAX_BODY_CHARS = 2000;

    private final InstanceHttpClient instanceHttpClient;

    public HttpProbe(InstanceHttpClient instanceHttpClient) {
        this.instanceHttpClient = instanceHttpClient;
    }

    public enum Failure {
        NOT_ALLOWED,
        DNS,
        REFUSED,
        TIMEOUT,
        UNREACHABLE,
        TLS,
        INVALID_URL,
        OTHER
    }

    public record Result(Integer httpStatus, String location, String body, long latencyMs, Failure failure, String errorMessage) {
        public boolean responded() {
            return httpStatus != null;
        }
    }

    public Result get(String url, Map<String, String> headers) {
        long started = System.nanoTime();
        HttpGet request;
        try {
            request = new HttpGet(URI.create(url));
        } catch (IllegalArgumentException e) {
            return new Result(null, null, null, 0, Failure.INVALID_URL, e.getMessage());
        }
        headers.forEach(request::addHeader);
        try {
            return instanceHttpClient.probeClient().execute(request, response -> {
                String body = response.getEntity() != null
                        ? EntityUtils.toString(response.getEntity(), StandardCharsets.UTF_8)
                        : null;
                if (body != null && body.length() > MAX_BODY_CHARS) {
                    body = body.substring(0, MAX_BODY_CHARS);
                }
                String location = response.getFirstHeader("Location") != null
                        ? response.getFirstHeader("Location").getValue()
                        : null;
                return new Result(response.getCode(), location, body, elapsedMs(started), null, null);
            });
        } catch (IOException e) {
            return new Result(null, null, null, elapsedMs(started), classify(e), e.getMessage());
        } catch (RuntimeException e) {
            return new Result(null, null, null, elapsedMs(started), Failure.OTHER, e.getMessage());
        }
    }

    static Failure classify(Throwable error) {
        for (Throwable t = error; t != null; t = t.getCause()) {
            if (t instanceof TargetNotAllowedException) return Failure.NOT_ALLOWED;
            if (t instanceof UnknownHostException) return Failure.DNS;
            if (t instanceof HttpHostConnectException) return Failure.REFUSED;
            if (t instanceof ConnectTimeoutException || t instanceof SocketTimeoutException) return Failure.TIMEOUT;
            if (t instanceof NoRouteToHostException) return Failure.UNREACHABLE;
            if (t instanceof SSLException) return Failure.TLS;
        }
        return Failure.OTHER;
    }

    /** German summary for a failed probe, used by several checks. */
    public static String describe(Failure failure) {
        return switch (failure) {
            case NOT_ALLOWED -> "Die Zieladresse ist in dieser Umgebung nicht erlaubt.";
            case DNS -> "Der Hostname lässt sich nicht auflösen (DNS).";
            case REFUSED -> "Die Verbindung wurde abgelehnt – auf dem Port lauscht kein Dienst.";
            case TIMEOUT -> "Zeitüberschreitung – der Host antwortet nicht.";
            case UNREACHABLE -> "Der Host ist nicht erreichbar (keine Route).";
            case TLS -> "Der TLS-Handshake ist fehlgeschlagen.";
            case INVALID_URL -> "Die Basis-URL ist ungültig.";
            case OTHER -> "Die Anfrage ist fehlgeschlagen.";
        };
    }

    private static long elapsedMs(long startedNanos) {
        return (System.nanoTime() - startedNanos) / 1_000_000;
    }
}
