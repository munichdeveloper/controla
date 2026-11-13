package de.atstck.controla.testing;

import de.atstck.controla.alerts.InstanceAlertHandler;
import de.atstck.controla.instance.Instance;
import de.atstck.controla.instance.InstanceCredentialService;
import de.atstck.controla.instance.InstanceRepository;
import de.atstck.controla.instance.InstanceService;
import de.atstck.controla.license.LicenseService;
import de.atstck.controla.security.CryptoService;
import de.atstck.controla.service.CoreApiClient;
import de.atstck.controla.service.InstanceHttpClient;
import de.atstck.controla.service.N8nApiClient;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipInputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Drives the real {@link N8nApiClient} and {@link InstanceService} against {@link FakeN8n}: status changes,
 * alerts, workflow errors and export, the way the scheduler runs them in production.
 */
class FakeN8nTest {

    private FakeN8n fake;
    private N8nApiClient client;
    private InstanceService service;
    private final InstanceAlertHandler alerts = mock(InstanceAlertHandler.class);
    private final InstanceRepository repository = mock(InstanceRepository.class);

    @BeforeEach
    void setUp() throws Exception {
        fake = FakeN8n.start();
        client = new N8nApiClient(new InstanceHttpClient(address -> address.isLoopbackAddress()));
        CryptoService crypto = mock(CryptoService.class);
        when(crypto.decrypt(anyString(), any())).thenAnswer(inv -> inv.getArgument(0)); // stored keys are plain in this test
        service = new InstanceService(mock(CoreApiClient.class), repository, client, crypto, mock(LicenseService.class),
                alerts, new InstanceCredentialService(crypto));
    }

    @AfterEach
    void tearDown() {
        fake.close();
    }

    @Test
    void systemInfoFollowsTheSimulatedState() {
        FakeN8n.Instance n8n = fake.instance("prod").version("1.82.3");

        assertThat(client.getSystemInfo(n8n.baseUrl(), n8n.apiKey())).isEqualTo(new N8nApiClient.SystemInfo("online", "1.82.3"));
        assertThat(client.getSystemInfo(n8n.baseUrl(), "wrong-key").status()).isEqualTo("auth_error");

        n8n.down();
        assertThat(client.getSystemInfo(n8n.baseUrl(), n8n.apiKey()).status()).isEqualTo("offline");
        n8n.down(FakeN8n.DownMode.BAD_GATEWAY);
        assertThat(client.getSystemInfo(n8n.baseUrl(), n8n.apiKey()).status()).isEqualTo("error");
        n8n.up();
        assertThat(client.getSystemInfo(n8n.baseUrl(), n8n.apiKey()).status()).isEqualTo("online");
    }

    @Test
    void outageAndRecoveryTriggerOfflineAndOnlineAlerts() {
        FakeN8n.Instance n8n = fake.instance("prod");
        Instance instance = connected(n8n);

        service.updateInstanceStatus(instance);
        assertThat(instance.getStatus()).isEqualTo("online");

        n8n.down();
        service.updateInstanceStatus(instance);
        assertThat(instance.getStatus()).isEqualTo("offline");
        verify(alerts).handleInstanceOffline(instance);

        n8n.up();
        service.updateInstanceStatus(instance);
        assertThat(instance.getStatus()).isEqualTo("online");
        verify(alerts).handleInstanceOnline(instance);
    }

    @Test
    void rotatedApiKeyTriggersInvalidKeyAlertButNoOfflineAlert() {
        FakeN8n.Instance n8n = fake.instance("prod");
        Instance instance = connected(n8n);
        service.updateInstanceStatus(instance);

        n8n.apiKey("rotated");
        service.updateInstanceStatus(instance);

        assertThat(instance.getStatus()).isEqualTo("error");
        verify(alerts).handleInvalidApiKey(instance);
        verify(alerts, never()).handleInstanceOffline(any());
    }

    @Test
    void failedExecutionTriggersWorkflowErrorAlertOnce() {
        FakeN8n.Instance n8n = fake.instance("prod");
        Instance instance = connected(n8n);
        service.updateInstanceStatus(instance);   // first run sets the error-check watermark

        String workflowId = n8n.addWorkflow("Invoice sync");
        n8n.addErrorExecution(workflowId, "Request failed with status code 500", Instant.now());
        service.updateInstanceStatus(instance);
        service.updateInstanceStatus(instance);

        verify(alerts, times(1)).handleWorkflowError(eq(instance), eq("Invoice sync"), eq("Request failed with status code 500"));
    }

    @Test
    void exportContainsEveryWorkflowEvenBeyondOnePage() throws IOException {
        FakeN8n.Instance n8n = fake.instance("big");
        for (int i = 0; i < 230; i++) n8n.addWorkflow("Workflow " + i);
        Instance instance = connected(n8n);

        byte[] zip = service.exportWorkflows(instance, null);

        assertThat(zipEntries(zip)).hasSize(230);
    }

    @Test
    void workflowCreateAcceptsOnlyWritableFieldsLikeN8n() {
        FakeN8n.Instance n8n = fake.instance("prod");
        RestTemplate http = new RestTemplate();
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-N8N-API-KEY", n8n.apiKey());
        headers.setContentType(MediaType.APPLICATION_JSON);
        Map<String, Object> valid = Map.of("name", "Imported", "nodes", List.of(), "connections", Map.of(),
                "settings", Map.of());

        @SuppressWarnings("unchecked") Map<String, Object> created = http.exchange(n8n.baseUrl() + "/api/v1/workflows", HttpMethod.POST,
                new HttpEntity<>(valid, headers), Map.class).getBody();
        assertThat(created).containsEntry("name", "Imported").containsKey("id");
        assertThat(n8n.workflows()).hasSize(1);

        Map<String, Object> exported = new java.util.HashMap<>(valid);
        exported.put("id", "abc");
        exported.put("active", true);
        assertThatThrownBy(() -> http.exchange(n8n.baseUrl() + "/api/v1/workflows", HttpMethod.POST,
                new HttpEntity<>(exported, headers), Map.class))
                .isInstanceOfSatisfying(HttpClientErrorException.class,
                        e -> assertThat(e.getStatusCode().value()).isEqualTo(400));
    }

    @Test
    void controlEndpointsDriveAStandaloneSandbox() {
        RestTemplate http = new RestTemplate();
        String root = fake.rootUrl() + "/__control";
        @SuppressWarnings("unchecked") Map<String, Object> created = http.postForObject(root + "/staging", Map.of("apiKey", "k1"), Map.class);
        assertThat(created).containsEntry("apiKey", "k1");

        http.postForObject(root + "/staging/down?mode=503", null, Map.class);
        assertThat(client.getSystemInfo(fake.instance("staging").baseUrl(), "k1").status()).isEqualTo("error");
        http.postForObject(root + "/staging/up", null, Map.class);

        @SuppressWarnings("unchecked") Map<String, Object> exec = http.postForObject(root + "/staging/error-execution", Map.of("message", "boom"), Map.class);
        assertThat(exec).containsKeys("executionId", "workflowId");
        assertThat(client.getExecutionErrors(fake.instance("staging").baseUrl(), "k1", 10))
                .singleElement().satisfies(e -> assertThat(e.getPayload()).containsEntry("errorMessage", "boom"));
    }

    private Instance connected(FakeN8n.Instance n8n) {
        Instance instance = new Instance();
        instance.setId((long) n8n.name().hashCode());
        instance.setExternalId("inst_" + n8n.name());
        instance.setTenantId("tenant");
        instance.setName(n8n.name());
        instance.setBaseUrl(n8n.baseUrl());
        instance.setApiKey(n8n.apiKey());
        instance.setStatus("unknown");
        return instance;
    }

    private static List<String> zipEntries(byte[] zip) throws IOException {
        List<String> names = new ArrayList<>();
        try (ZipInputStream in = new ZipInputStream(new ByteArrayInputStream(zip))) {
            for (var entry = in.getNextEntry(); entry != null; entry = in.getNextEntry()) names.add(entry.getName());
        }
        return names;
    }
}
