package de.atstck.controla.service;

import de.atstck.controla.diagnostics.checks.LocalHttpServer;
import de.atstck.controla.diagnostics.checks.LocalHttpServer.Response;
import de.atstck.controla.security.InstanceTargetPolicy;
import de.atstck.controla.security.TargetNotAllowedException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.web.client.ResourceAccessException;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** The target policy applies to every connection; redirects stay on the same host. */
class InstanceHttpClientTest {

    private static final InstanceTargetPolicy ONLY_127_0_0_1 = address -> address.getHostAddress().equals("127.0.0.1");

    @Test
    void allowedTargetIsCalled() throws Exception {
        try (LocalHttpServer server = new LocalHttpServer()) {
            server.route("/ok", Response.of(200, "fine"));

            String body = new InstanceHttpClient(ONLY_127_0_0_1).restTemplate()
                    .getForObject(server.baseUrl() + "/ok", String.class);

            assertThat(body).isEqualTo("fine");
        }
    }

    @Test
    void blockedTargetIsNeverContacted() throws Exception {
        try (LocalHttpServer server = new LocalHttpServer()) {
            InstanceTargetPolicy blockAll = address -> false;

            assertThatThrownBy(() -> new InstanceHttpClient(blockAll).restTemplate()
                    .getForObject(server.baseUrl() + "/ok", String.class))
                    .isInstanceOf(ResourceAccessException.class)
                    .hasRootCauseInstanceOf(TargetNotAllowedException.class);
            assertThat(server.requestHeaders).isEmpty();
        }
    }

    @Test
    void sameHostRedirectIsFollowed() throws Exception {
        try (LocalHttpServer server = new LocalHttpServer()) {
            server.route("/old", new Response(302, "", Map.of("Location", server.baseUrl() + "/new")));
            server.route("/new", Response.of(200, "moved"));

            String body = new InstanceHttpClient(ONLY_127_0_0_1).restTemplate()
                    .getForObject(server.baseUrl() + "/old", String.class);

            assertThat(body).isEqualTo("moved");
        }
    }

    @Test
    void redirectToAnotherHostIsNotFollowedSoCredentialsStayPut() throws Exception {
        try (LocalHttpServer server = new LocalHttpServer(); LocalHttpServer other = new LocalHttpServer()) {
            server.route("/redirect", new Response(302, "",
                    Map.of("Location", "http://localhost:" + other.port() + "/steal")));
            HttpHeaders headers = new HttpHeaders();
            headers.set("X-N8N-API-KEY", "secret");

            assertThatThrownBy(() -> new InstanceHttpClient(address -> true).restTemplate()
                    .exchange(server.baseUrl() + "/redirect", HttpMethod.GET, new HttpEntity<>(headers), String.class))
                    .isInstanceOf(ResourceAccessException.class);
            assertThat(server.requestHeaders).hasSize(1);
            assertThat(other.requestHeaders).isEmpty();
        }
    }
}
