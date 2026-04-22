package de.atstck.controla.instance;

import de.atstck.controla.alerts.InstanceAlertHandler;
import de.atstck.controla.license.LicenseService;
import de.atstck.controla.security.CryptoService;
import de.atstck.controla.security.TenantContext;
import de.atstck.controla.service.CoreApiClient;
import de.atstck.controla.service.N8nApiClient;
import de.atstck.controla.service.N8nApiClient.SystemInfo;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import javax.crypto.SecretKey;
import java.time.LocalDateTime;
import java.util.Collections;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class InstanceServiceTest {

    @Mock
    private CoreApiClient coreApiClient;

    @Mock
    private InstanceRepository instanceRepository;

    @Mock
    private N8nApiClient n8nApiClient;

    @Mock
    private CryptoService cryptoService;

    @Mock
    private LicenseService licenseService;

    @Mock
    private InstanceAlertHandler instanceAlertHandler;

    @Mock
    private SecretKey secretKey;

    private InstanceService instanceService;

    @BeforeEach
    void setUp() {
        instanceService = new InstanceService(
                coreApiClient,
                instanceRepository,
                n8nApiClient,
                cryptoService,
                licenseService,
                instanceAlertHandler
        );
    }

    @Test
    void testStatusTransitionErrorToOfflineTriggersAlert() {
        // Arrange: Setup tenant context
        TenantContext.setTenantId("test-tenant");

        Instance instance = new Instance();
        instance.setId(1L);
        instance.setExternalId("inst_test");
        instance.setTenantId("test-tenant");
        instance.setName("Test Instance");
        instance.setBaseUrl("http://localhost:5678");
        instance.setApiKey("encrypted-key");
        instance.setStatus("error");  // Current status is "error"
        instance.setVersion("1.0.0");
        instance.setLastSeenAt(LocalDateTime.now());

        when(cryptoService.getMasterKey()).thenReturn(secretKey);
        when(cryptoService.decrypt(any(), any())).thenReturn("decrypted-api-key");
        when(n8nApiClient.getSystemInfo(any(), any()))
                .thenReturn(new SystemInfo("offline", "1.0.0")); // Simulate error -> offline transition


        // Act: Call updateInstanceStatus which should transition from error -> offline
        instanceService.updateInstanceStatus(instance);

        // Assert: Verify that handleInstanceOffline was called
        verify(instanceAlertHandler, times(1)).handleInstanceOffline(instance);
        // Verify that the status was updated to "offline"
        assertEquals("offline", instance.getStatus());
    }

    @Test
    void testStatusTransitionOnlineToOfflineTriggersAlert() {
        // Arrange: Setup tenant context
        TenantContext.setTenantId("test-tenant");

        Instance instance = new Instance();
        instance.setId(1L);
        instance.setExternalId("inst_test");
        instance.setTenantId("test-tenant");
        instance.setName("Test Instance");
        instance.setBaseUrl("http://localhost:5678");
        instance.setApiKey("encrypted-key");
        instance.setStatus("online");  // Current status is "online"
        instance.setVersion("1.0.0");
        instance.setLastSeenAt(LocalDateTime.now());

        when(cryptoService.getMasterKey()).thenReturn(secretKey);
        when(cryptoService.decrypt(any(), any())).thenReturn("decrypted-api-key");
        when(n8nApiClient.getSystemInfo(any(), any()))
                .thenReturn(new SystemInfo("offline", "1.0.0")); // Simulate online -> offline transition


        // Act: Call updateInstanceStatus which should transition from online -> offline
        instanceService.updateInstanceStatus(instance);

        // Assert: Verify that handleInstanceOffline was called
        verify(instanceAlertHandler, times(1)).handleInstanceOffline(instance);
        // Verify that the status was updated to "offline"
        assertEquals("offline", instance.getStatus());
    }

    @Test
    void testStatusTransitionOfflineToOnlineTriggersAlert() {
        // Arrange: Setup tenant context
        TenantContext.setTenantId("test-tenant");

        Instance instance = new Instance();
        instance.setId(1L);
        instance.setExternalId("inst_test");
        instance.setTenantId("test-tenant");
        instance.setName("Test Instance");
        instance.setBaseUrl("http://localhost:5678");
        instance.setApiKey("encrypted-key");
        instance.setStatus("offline");  // Current status is "offline"
        instance.setVersion("1.0.0");
        instance.setLastSeenAt(LocalDateTime.now());

        when(cryptoService.getMasterKey()).thenReturn(secretKey);
        when(cryptoService.decrypt(any(), any())).thenReturn("decrypted-api-key");
        when(n8nApiClient.getSystemInfo(any(), any()))
                .thenReturn(new SystemInfo("online", "1.5.0"));

        when(n8nApiClient.getLatestN8nVersion()).thenReturn("1.5.0");
        when(n8nApiClient.getExecutionErrors(any(), any(), anyInt())).thenReturn(Collections.emptyList());

        // Act: Call updateInstanceStatus which should transition from offline -> online
        instanceService.updateInstanceStatus(instance);

        // Assert: Verify that handleInstanceOnline was called
        verify(instanceAlertHandler, times(1)).handleInstanceOnline(instance);
        // Verify that the status was updated to "online"
        assertEquals("online", instance.getStatus());
    }

    @Test
    void testStatusNoTransitionDoesNotTriggerAlert() {
        // Arrange: Setup tenant context
        TenantContext.setTenantId("test-tenant");

        Instance instance = new Instance();
        instance.setId(1L);
        instance.setExternalId("inst_test");
        instance.setTenantId("test-tenant");
        instance.setName("Test Instance");
        instance.setBaseUrl("http://localhost:5678");
        instance.setApiKey("encrypted-key");
        instance.setStatus("online");  // Current status is "online"
        instance.setVersion("1.0.0");
        instance.setLastSeenAt(LocalDateTime.now());

        when(cryptoService.getMasterKey()).thenReturn(secretKey);
        when(cryptoService.decrypt(any(), any())).thenReturn("decrypted-api-key");
        when(n8nApiClient.getSystemInfo(any(), any()))
                .thenReturn(new SystemInfo("online", "1.0.0"));

        when(n8nApiClient.getLatestN8nVersion()).thenReturn("1.5.0");
        when(n8nApiClient.getExecutionErrors(any(), any(), anyInt())).thenReturn(Collections.emptyList());

        // Act: Call updateInstanceStatus with no status change
        instanceService.updateInstanceStatus(instance);

        // Assert: Verify that no alert handler was called
        verify(instanceAlertHandler, never()).handleInstanceOffline(any());
        verify(instanceAlertHandler, never()).handleInstanceOnline(any());
        // Status should remain "online"
        assertEquals("online", instance.getStatus());
    }
}

