package de.atstck.controla.diagnostics.checks;

import de.atstck.controla.diagnostics.DiagnosticContext;
import de.atstck.controla.diagnostics.DiagnosticResult;
import de.atstck.controla.diagnostics.DiagnosticStatus;
import de.atstck.controla.diagnostics.HttpProbe;
import de.atstck.controla.diagnostics.checks.LocalHttpServer.Response;
import de.atstck.controla.instance.Instance;
import de.atstck.controla.security.AllowAllTargetPolicy;
import de.atstck.controla.security.InstanceTargetPolicy;
import de.atstck.controla.service.InstanceHttpClient;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.net.ServerSocket;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class N8nHttpChecksTest {

    private LocalHttpServer server;
    private final InstanceTargetPolicy allowAll = new AllowAllTargetPolicy();
    private final HttpProbe probe = new HttpProbe(new InstanceHttpClient(allowAll));

    @BeforeEach
    void setUp() throws Exception {
        server = new LocalHttpServer();
    }

    @AfterEach
    void tearDown() {
        server.close();
    }

    private DiagnosticContext context(String baseUrl, String apiKey) {
        Instance instance = new Instance();
        instance.setExternalId("inst_1");
        instance.setBaseUrl(baseUrl);
        return new DiagnosticContext(instance, () -> apiKey, "tenant", Instant.now());
    }

    private static int freePort() throws Exception {
        try (ServerSocket socket = new ServerSocket(0)) {
            return socket.getLocalPort();
        }
    }

    @Test
    void reachabilityOkForAnyNonServerErrorResponse() {
        server.route("/", Response.of(200, "<html>n8n</html>"));

        DiagnosticResult result = new N8nReachabilityCheck(probe, allowAll, 2000).run(context(server.baseUrl(), "k"));

        assertThat(result.status()).isEqualTo(DiagnosticStatus.OK);
        assertThat(result.details()).containsEntry("httpStatus", 200).containsKey("addresses");
    }

    @Test
    void reachabilityFailsForProxyErrors() {
        server.route("/", Response.of(502, "Bad Gateway"));

        DiagnosticResult result = new N8nReachabilityCheck(probe, allowAll, 2000).run(context(server.baseUrl(), "k"));

        assertThat(result.status()).isEqualTo(DiagnosticStatus.FAIL);
        assertThat(result.summary()).contains("502");
    }

    @Test
    void reachabilityDistinguishesRefusedConnectionsAndInvalidUrls() throws Exception {
        DiagnosticResult refused = new N8nReachabilityCheck(probe, allowAll, 2000)
                .run(context("http://127.0.0.1:" + freePort(), "k"));
        DiagnosticResult invalid = new N8nReachabilityCheck(probe, allowAll, 2000).run(context("not a url", "k"));
        DiagnosticResult dns = new N8nReachabilityCheck(probe, allowAll, 2000)
                .run(context("http://does-not-exist.invalid", "k"));

        assertThat(refused.status()).isEqualTo(DiagnosticStatus.FAIL);
        assertThat(refused.summary()).contains("abgelehnt");
        assertThat(invalid.summary()).contains("ungültig");
        assertThat(dns.summary()).contains("DNS");
    }

    @Test
    void reachabilityReportsBlockedTargets() {
        InstanceTargetPolicy blockAll = address -> false;

        DiagnosticResult result = new N8nReachabilityCheck(new HttpProbe(new InstanceHttpClient(blockAll)), blockAll, 2000)
                .run(context(server.baseUrl(), "k"));

        assertThat(result.status()).isEqualTo(DiagnosticStatus.FAIL);
        assertThat(result.summary()).contains("nicht erlaubt");
        assertThat(server.requestHeaders).isEmpty();
    }

    @Test
    void healthAndReadiness() {
        server.route("/healthz", Response.of(200, "{\"status\":\"ok\"}"))
                .route("/healthz/readiness", Response.of(503, "{\"status\":\"error\"}"));

        assertThat(new N8nHealthCheck(probe).run(context(server.baseUrl(), "k")).status()).isEqualTo(DiagnosticStatus.OK);
        DiagnosticResult readiness = new N8nReadinessCheck(probe).run(context(server.baseUrl() + "/", "k"));
        assertThat(readiness.status()).isEqualTo(DiagnosticStatus.FAIL);
        assertThat(readiness.summary()).contains("Datenbank");
    }

    @Test
    void missingHealthEndpointsAreSkipped() {
        assertThat(new N8nHealthCheck(probe).run(context(server.baseUrl(), "k")).status()).isEqualTo(DiagnosticStatus.SKIPPED);
        assertThat(new N8nReadinessCheck(probe).run(context(server.baseUrl(), "k")).status()).isEqualTo(DiagnosticStatus.SKIPPED);
    }

    @Test
    void apiAuthSendsTheKeyAndClassifiesAnswers() {
        server.route("/api/v1/workflows?limit=1", Response.of(401, "{\"message\":\"unauthorized\"}"));

        DiagnosticResult rejected = new N8nApiAuthCheck(probe).run(context(server.baseUrl(), "secret-key"));

        assertThat(rejected.status()).isEqualTo(DiagnosticStatus.FAIL);
        assertThat(rejected.summary()).contains("abgelehnt");
        assertThat(server.requestHeaders.get(0).get("X-n8n-api-key")).containsExactly("secret-key");

        server.route("/api/v1/workflows?limit=1", Response.of(200, "{\"data\":[]}"));
        assertThat(new N8nApiAuthCheck(probe).run(context(server.baseUrl(), "secret-key")).status()).isEqualTo(DiagnosticStatus.OK);
        assertThat(new N8nApiAuthCheck(probe).run(context(server.baseUrl(), null)).status()).isEqualTo(DiagnosticStatus.FAIL);
    }

    @Test
    void apiAuthDoesNotFollowRedirectsWithTheKey() {
        server.route("/api/v1/workflows?limit=1",
                new Response(302, "", Map.of("Location", "http://elsewhere.invalid/api/v1/workflows")));

        DiagnosticResult result = new N8nApiAuthCheck(probe).run(context(server.baseUrl(), "secret-key"));

        assertThat(result.status()).isEqualTo(DiagnosticStatus.WARN);
        assertThat(result.details()).containsEntry("location", "http://elsewhere.invalid/api/v1/workflows");
        assertThat(server.requestHeaders).hasSize(1);
    }

    @Test
    void tlsCheckAppliesOnlyToHttps() {
        N8nTlsCheck tls = new N8nTlsCheck(allowAll, 14);

        assertThat(tls.appliesTo(context("https://n8n.example.com", "k"))).isTrue();
        assertThat(tls.appliesTo(context("http://n8n.example.com", "k"))).isFalse();
        assertThat(tls.appliesTo(context("::invalid", "k"))).isFalse();
    }

    @Test
    void tlsCheckSkipsWhenNoTlsEndpointAnswers() throws Exception {
        DiagnosticResult result = new N8nTlsCheck(allowAll, 14).run(context("https://127.0.0.1:" + freePort(), "k"));

        assertThat(result.status()).isEqualTo(DiagnosticStatus.SKIPPED);
    }

    @Test
    void probeUsesOnlyGivenHeaders() {
        server.route("/x", Response.of(204, ""));

        HttpProbe.Result result = probe.get(server.baseUrl() + "/x", Map.of("Accept", "application/json"));

        assertThat(result.httpStatus()).isEqualTo(204);
        assertThat(server.requestHeaders.get(0)).doesNotContainKey("X-n8n-api-key");
        assertThat(List.of(result.latencyMs())).allMatch(ms -> ms >= 0);
    }
    @Test
    void reachabilityAcceptsUpperCaseScheme() {
        server.route("/", Response.of(200, "ok"));

        DiagnosticResult result = new N8nReachabilityCheck(probe, allowAll, 2000)
                .run(context(server.baseUrl().replace("http://", "HTTP://"), "k"));

        assertThat(result.status()).isEqualTo(DiagnosticStatus.OK);
    }

    @Test
    void tlsCheckHandlesIpLiterals() throws Exception {
        assertThat(N8nTlsCheck.isIpLiteral("::1")).isTrue();
        assertThat(N8nTlsCheck.isIpLiteral("10.0.0.1")).isTrue();
        assertThat(N8nTlsCheck.isIpLiteral("n8n.example.com")).isFalse();

        DiagnosticResult result = new N8nTlsCheck(allowAll, 14).run(context("https://[::1]:" + freePort(), "k"));

        assertThat(result.status()).isNotEqualTo(DiagnosticStatus.ERROR);
    }

    @Test
    void probeReadsOnlyAPrefixOfEndlessBodies() throws Exception {
        try (ServerSocket endless = new ServerSocket(0, 1, java.net.InetAddress.getByName("127.0.0.1"))) {
            Thread writer = new Thread(() -> {
                try (java.net.Socket socket = endless.accept()) {
                    java.io.OutputStream out = socket.getOutputStream();
                    out.write("HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nTransfer-Encoding: chunked\r\n\r\n"
                            .getBytes(java.nio.charset.StandardCharsets.US_ASCII));
                    byte[] chunk = ("1000\r\n" + "x".repeat(4096) + "\r\n").getBytes(java.nio.charset.StandardCharsets.US_ASCII);
                    while (true) {
                        out.write(chunk);
                    }
                } catch (java.io.IOException ignored) {
                    // client dropped the connection
                }
            });
            writer.setDaemon(true);
            writer.start();

            long started = System.nanoTime();
            HttpProbe.Result result = probe.get("http://127.0.0.1:" + endless.getLocalPort() + "/", Map.of());

            assertThat(result.httpStatus()).isEqualTo(200);
            assertThat(result.body()).hasSize(2000);
            assertThat(java.time.Duration.ofNanos(System.nanoTime() - started)).isLessThan(java.time.Duration.ofSeconds(5));
            writer.join(5000);
            assertThat(writer.isAlive()).isFalse();
        }
    }
}
