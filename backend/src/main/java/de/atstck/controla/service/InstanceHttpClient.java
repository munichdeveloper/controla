package de.atstck.controla.service;

import de.atstck.controla.security.InstanceTargetPolicy;
import de.atstck.controla.security.PolicyDnsResolver;
import jakarta.annotation.PreDestroy;
import org.apache.hc.client5.http.config.ConnectionConfig;
import org.apache.hc.client5.http.config.RequestConfig;
import org.apache.hc.client5.http.impl.DefaultRedirectStrategy;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.HttpClientBuilder;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManagerBuilder;
import org.apache.hc.core5.http.HttpException;
import org.apache.hc.core5.http.HttpRequest;
import org.apache.hc.core5.http.HttpResponse;
import org.apache.hc.core5.http.ProtocolException;
import org.apache.hc.core5.http.protocol.HttpContext;
import org.apache.hc.core5.util.Timeout;
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;

/**
 * HTTP access to customer-provided URLs (n8n instances, companions).
 * Every connection is resolved through {@link PolicyDnsResolver}, so the
 * {@link InstanceTargetPolicy} applies to the first request and to every
 * redirect hop. Redirects are followed only within the same host, so
 * credential headers (e.g. {@code X-N8N-API-KEY}) never reach another host.
 * Calls to internal services (core API, mail, billing) use the regular
 * {@code restTemplate} bean instead.
 */
@Component
public class InstanceHttpClient {

    public static final Timeout CONNECT_TIMEOUT = Timeout.ofSeconds(5);
    public static final Timeout RESPONSE_TIMEOUT = Timeout.ofSeconds(30);
    public static final Timeout PROBE_RESPONSE_TIMEOUT = Timeout.ofSeconds(10);

    private final InstanceTargetPolicy policy;
    private final CloseableHttpClient apiClient;
    private final CloseableHttpClient probeClient;
    private final RestTemplate restTemplate;

    public InstanceHttpClient(InstanceTargetPolicy policy) {
        this.policy = policy;
        this.apiClient = builder(RESPONSE_TIMEOUT)
                .setRedirectStrategy(new SameHostRedirectStrategy())
                .build();
        this.probeClient = builder(PROBE_RESPONSE_TIMEOUT)
                .disableRedirectHandling()
                .disableAutomaticRetries()
                .build();
        this.restTemplate = new RestTemplate(new HttpComponentsClientHttpRequestFactory(apiClient));
    }

    private HttpClientBuilder builder(Timeout responseTimeout) {
        return HttpClients.custom()
                .setConnectionManager(PoolingHttpClientConnectionManagerBuilder.create()
                        .setDnsResolver(new PolicyDnsResolver(policy))
                        .setDefaultConnectionConfig(ConnectionConfig.custom()
                                .setConnectTimeout(CONNECT_TIMEOUT)
                                .setSocketTimeout(responseTimeout)
                                .build())
                        .setMaxConnTotal(100)
                        .setMaxConnPerRoute(10)
                        .build())
                .setDefaultRequestConfig(RequestConfig.custom()
                        .setConnectionRequestTimeout(CONNECT_TIMEOUT)
                        .setResponseTimeout(responseTimeout)
                        .build());
    }

    /** RestTemplate for API calls to customer URLs (follows same-host redirects, policy checked per hop). */
    public RestTemplate restTemplate() {
        return restTemplate;
    }

    /** Client for diagnostic probes: no redirects, no retries, short response timeout. */
    public CloseableHttpClient probeClient() {
        return probeClient;
    }

    public InstanceTargetPolicy policy() {
        return policy;
    }

    /**
     * Follows a redirect only if it stays on the host of the redirected
     * request (scheme and port may change, e.g. http → https). Requests carry
     * credentials as custom headers, which the default strategy would forward
     * to any host.
     */
    static final class SameHostRedirectStrategy extends DefaultRedirectStrategy {

        @Override
        public URI getLocationURI(HttpRequest request, HttpResponse response, HttpContext context) throws HttpException {
            URI location = super.getLocationURI(request, response, context);
            String currentHost;
            try {
                currentHost = request.getUri().getHost();
            } catch (URISyntaxException e) {
                throw new ProtocolException("Invalid request URI", e);
            }
            if (currentHost == null || location.getHost() == null
                    || !currentHost.equalsIgnoreCase(location.getHost())) {
                throw new ProtocolException("Redirect to another host is not followed: " + location.getHost());
            }
            return location;
        }
    }

    @PreDestroy
    void close() throws IOException {
        apiClient.close();
        probeClient.close();
    }
}
