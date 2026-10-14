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
import org.apache.hc.core5.util.Timeout;
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.io.IOException;

/**
 * HTTP access to customer-provided URLs (n8n instances, companions).
 * Every connection is resolved through {@link PolicyDnsResolver}, so the
 * {@link InstanceTargetPolicy} applies to the first request and to every
 * redirect hop. Calls to internal services (core API, mail, billing) use the
 * regular {@code restTemplate} bean instead.
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
                .setRedirectStrategy(DefaultRedirectStrategy.INSTANCE)
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

    /** RestTemplate for API calls to customer URLs (follows redirects, policy checked per hop). */
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

    @PreDestroy
    void close() throws IOException {
        apiClient.close();
        probeClient.close();
    }
}
