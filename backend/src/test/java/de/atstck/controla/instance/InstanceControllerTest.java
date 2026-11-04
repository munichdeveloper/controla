package de.atstck.controla.instance;

import de.atstck.controla.alerts.InstanceAlertHandler;
import de.atstck.controla.license.LicenseService;
import de.atstck.controla.security.CryptoService;
import de.atstck.controla.security.TenantContext;
import de.atstck.controla.service.CoreApiClient;
import de.atstck.controla.service.N8nApiClient;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import javax.crypto.SecretKey;
import java.util.Collections;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class InstanceControllerTest {

    private static final String TENANT = "hosted-tenant";
    private static final String REQUEST = """
            {"name":"Fourth instance","baseUrl":"https://n8n.example.com","apiKey":"test-key"}
            """;

    private final InstanceRepository repository = mock(InstanceRepository.class);
    private final LicenseService license = mock(LicenseService.class);
    private final CryptoService crypto = mock(CryptoService.class);
    private final N8nApiClient n8n = mock(N8nApiClient.class);
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId(TENANT);
        InstanceService service = new InstanceService(mock(CoreApiClient.class), repository, n8n,
                crypto, license, mock(InstanceAlertHandler.class), new InstanceCredentialService(crypto));
        mvc = MockMvcBuilders.standaloneSetup(new InstanceController(service)).build();
    }

    @AfterEach
    void clearTenant() {
        TenantContext.clear();
    }

    @ParameterizedTest(name = "{0}: limit={1}, existing={2}")
    @CsvSource({
            "Hosted Ops, -1, 3",
            "Hosted Ops, -1, 12",
            "Premium Edition, -1, 3",
            "Community Edition, 3, 2",
            "Hosted Ops, 5, 4"
    })
    void createsInstancesWithinTheLicensedLimit(String edition, int limit, int existing) throws Exception {
        configureLicense(edition, limit, existing);
        SecretKey key = mock(SecretKey.class);
        when(crypto.getMasterKey()).thenReturn(key);
        when(crypto.encrypt("test-key", key)).thenReturn("encrypted-key");
        when(repository.save(any(Instance.class))).thenAnswer(invocation -> invocation.getArgument(0));

        mvc.perform(post("/api/instances").contentType(MediaType.APPLICATION_JSON).content(REQUEST))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("name").value("Fourth instance"))
                .andExpect(jsonPath("baseUrl").value("https://n8n.example.com"));

        verify(repository).save(argThat(instance -> TENANT.equals(instance.getTenantId())
                && "encrypted-key".equals(instance.getApiKey())));
        if (limit == -1) {
            verify(repository, never()).lockInstanceCreation(anyString());
            verify(repository, never()).countByTenantId(anyString());
        } else {
            verify(repository).countByTenantId(TENANT);
        }
        verifyNoStatusRefresh();
    }

    @ParameterizedTest(name = "{0}: limit={1}, existing={2}")
    @CsvSource({
            "Community Edition, 3, 3",
            "Community Edition, 3, 4",
            "Hosted Ops, 5, 5",
            "Hosted Ops, 5, 6",
            "Hosted Ops, 0, 0"
    })
    void rejectsInstancesAtOrAboveTheLicensedLimit(String edition, int limit, int existing) throws Exception {
        configureLicense(edition, limit, existing);

        mvc.perform(post("/api/instances").contentType(MediaType.APPLICATION_JSON).content(REQUEST))
                .andExpect(status().isForbidden())
                .andExpect(content().string("Maximale Anzahl an Instanzen (" + limit + ") für "
                        + edition + " erreicht."));

        verify(repository).countByTenantId(TENANT);
        verify(repository, never()).save(any(Instance.class));
        verifyNoInteractions(crypto);
        verifyNoStatusRefresh();
    }

    @Test
    void otherCreationFailuresRemainBadRequests() throws Exception {
        configureLicense("Hosted Ops", -1, 0);
        when(crypto.getMasterKey()).thenThrow(new IllegalStateException("Master key unavailable"));

        mvc.perform(post("/api/instances").contentType(MediaType.APPLICATION_JSON).content(REQUEST))
                .andExpect(status().isBadRequest())
                .andExpect(content().string("Fehler beim Erstellen der Instanz: Master key unavailable"));

        verify(repository, never()).save(any(Instance.class));
    }

    @Test
    void requestCannotOverrideTheServerLicenseOrTenant() throws Exception {
        configureLicense("Community Edition", 3, 3);
        String forged = REQUEST.stripTrailing().replace("}", """
                ,"maxInstances":-1,"edition":"Hosted Ops","tenantId":"other-tenant"}
                """);

        mvc.perform(post("/api/instances").param("maxInstances", "-1").param("edition", "Hosted Ops")
                        .header("X-Tenant-Id", "other-tenant")
                        .contentType(MediaType.APPLICATION_JSON).content(forged))
                .andExpect(status().isForbidden());

        verify(repository).lockInstanceCreation(TENANT);
        verify(repository).countByTenantId(TENANT);
        verify(repository, never()).countByTenantId("other-tenant");
        verify(repository, never()).save(any(Instance.class));
    }

    private void configureLicense(String edition, int limit, int existing) {
        when(license.getEditionName()).thenReturn(edition);
        when(license.getMaxInstances()).thenReturn(limit);
        when(repository.countByTenantId(TENANT)).thenReturn((long) existing);
        when(repository.findByTenantId(TENANT)).thenReturn(Collections.nCopies(existing, new Instance()));
    }

    private void verifyNoStatusRefresh() {
        verify(repository, never()).findByTenantId(anyString());
        verify(repository, never()).saveAll(any());
        verify(n8n, never()).getSystemInfo(any(), any());
    }
}
