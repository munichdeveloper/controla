package de.atstck.controla.service;

import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class N8nApiClientLatestVersionTest {

    private final RestTemplate restTemplate = mock(RestTemplate.class);
    private final N8nApiClient client;

    N8nApiClientLatestVersionTest() {
        InstanceHttpClient http = mock(InstanceHttpClient.class);
        when(http.restTemplate()).thenReturn(restTemplate);
        client = new N8nApiClient(http);
    }

    private static Map<String, Object> tags(String... names) {
        return Map.of("results", java.util.Arrays.stream(names).map(n -> Map.of("name", n)).toList());
    }

    @Test
    void picksHighestStableVersionAndIgnoresSuffixedTags() {
        when(restTemplate.getForObject(contains("hub.docker.com"), eq(Map.class))).thenReturn(tags(
                "latest", "next", "2.48.4", "2.9.0", "3.3.0", "3.10.1", "3.11.0-rc.1", "3.12.0-debian",
                "4.0.0-arm64", "3.9.9", "beta", "5.0.0-beta.1"));

        assertThat(client.getLatestN8nVersion()).isEqualTo("3.10.1");
    }

    @Test
    void cachesResult() {
        when(restTemplate.getForObject(contains("hub.docker.com"), eq(Map.class))).thenReturn(tags("2.48.4", "3.3.0"));

        assertThat(client.getLatestN8nVersion()).isEqualTo("3.3.0");
        assertThat(client.getLatestN8nVersion()).isEqualTo("3.3.0");
        verify(restTemplate, times(1)).getForObject(contains("hub.docker.com"), eq(Map.class));
    }

    @Test
    void fallsBackToNpmThenUnknown() {
        when(restTemplate.getForObject(contains("hub.docker.com"), eq(Map.class))).thenThrow(new RuntimeException("down"));
        when(restTemplate.getForObject(contains("registry.npmjs.org"), eq(Map.class))).thenReturn(Map.of("version", "2.48.4"));
        assertThat(client.getLatestN8nVersion()).isEqualTo("2.48.4");
    }

    @Test
    void unknownWhenNothingAvailable() {
        when(restTemplate.getForObject(contains("hub.docker.com"), eq(Map.class))).thenReturn(tags("latest"));
        when(restTemplate.getForObject(contains("registry.npmjs.org"), eq(Map.class))).thenThrow(new RuntimeException("down"));
        assertThat(client.getLatestN8nVersion()).isEqualTo("unknown");
    }
}
