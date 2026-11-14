package de.atstck.controla.instance;

import de.atstck.controla.alerts.InstanceAlertHandler;
import de.atstck.controla.dto.CreateInstanceDto;
import de.atstck.controla.license.LicenseService;
import de.atstck.controla.security.CryptoService;
import de.atstck.controla.security.TenantContext;
import de.atstck.controla.service.CoreApiClient;
import de.atstck.controla.service.InstanceStatusChecker;
import de.atstck.controla.service.N8nApiClient;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class InstanceLifecycleTest {
    private static final String TENANT = "tenant-a";
    private final InstanceRepository repository = mock(InstanceRepository.class);
    private final LicenseService license = mock(LicenseService.class);
    private final CryptoService crypto = mock(CryptoService.class);
    private final N8nApiClient n8n = mock(N8nApiClient.class);
    private final InstanceAlertHandler alerts = mock(InstanceAlertHandler.class);
    private final List<String> calls = new ArrayList<>();
    private final InstanceLifecycleListener listener = new InstanceLifecycleListener() {
        @Override public void onArchived(Instance instance) { calls.add("archive:" + instance.getArchivedAt()); }
        @Override public void onRestored(Instance instance) { calls.add("restore:" + instance.getArchivedAt()); }
        @Override public void beforeDelete(Instance instance, InstanceDeleteOptions options) {
            calls.add("delete:" + options.deleteExternalData());
        }
    };
    private InstanceService service;
    private MockMvc mvc;
    private Instance instance;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId(TENANT);
        service = new InstanceService(mock(CoreApiClient.class), repository, n8n, crypto, license, alerts,
                new InstanceCredentialService(crypto));
        service.configureLifecycle(tenant -> Duration.ofHours(6), List.of(listener));
        mvc = MockMvcBuilders.standaloneSetup(new InstanceController(service)).build();
        instance = new Instance();
        instance.setId(1L);
        instance.setExternalId("inst_a");
        instance.setTenantId(TENANT);
        instance.setName("Production");
        instance.setBaseUrl("https://n8n.example.com");
        instance.setApiKey("encrypted-key");
        instance.setStatus("online");
        when(repository.findByExternalIdAndTenantId("inst_a", TENANT)).thenReturn(Optional.of(instance));
        when(repository.save(any(Instance.class))).thenAnswer(call -> call.getArgument(0));
        when(license.getMaxInstances()).thenReturn(1);
    }

    @AfterEach
    void clearTenant() { TenantContext.clear(); }

    @Test
    void endpointsArchiveRestoreAndNotifyExactlyOncePerTransition() throws Exception {
        mvc.perform(post("/api/instances/inst_a/archive"))
                .andExpect(status().isOk()).andExpect(jsonPath("archivedAt").isNotEmpty())
                .andExpect(jsonPath("slotAvailableAt").isNotEmpty());
        Instant archivedAt = instance.getArchivedAt();
        mvc.perform(post("/api/instances/inst_a/archive")).andExpect(status().isOk());
        assertThat(instance.getArchivedAt()).isEqualTo(archivedAt);
        when(repository.countByTenantId(TENANT)).thenReturn(1L);
        mvc.perform(post("/api/instances/inst_a/restore"))
                .andExpect(status().isOk()).andExpect(jsonPath("archivedAt").isEmpty());
        mvc.perform(post("/api/instances/inst_a/restore")).andExpect(status().isOk());
        assertThat(calls).containsExactly("archive:" + archivedAt, "restore:null");
        assertThat(instance.getLastErrorCheck()).isNotNull();
        verifyNoInteractions(crypto, alerts);
        verify(n8n, never()).getSystemInfo(any(), any());
    }

    @ParameterizedTest
    @ValueSource(strings = {"missing", "foreign"})
    void allLifecycleEndpointsResolveOnlyWithinTheTenant(String id) throws Exception {
        mvc.perform(post("/api/instances/" + id + "/archive")).andExpect(status().isNotFound());
        mvc.perform(post("/api/instances/" + id + "/restore")).andExpect(status().isNotFound());
        mvc.perform(delete("/api/instances/" + id)).andExpect(status().isNotFound());
        verify(repository, times(3)).findByExternalIdAndTenantId(id, TENANT);
        verify(repository, never()).findByExternalIdAndTenantId(id, "tenant-b");
        verify(repository, never()).delete(any());
        assertThat(calls).isEmpty();
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void deletionPassesExternalOptionAndRetainsOnlyTemporaryReservation(boolean external) throws Exception {
        var request = delete("/api/instances/inst_a");
        if (external) request.contentType(MediaType.APPLICATION_JSON).content("{\"deleteExternalData\":true}");
        mvc.perform(request).andExpect(status().isNoContent());
        assertThat(calls).containsExactly("delete:" + external);
        verify(repository).reserveDeletedSlot(eq(TENANT), eq(instance.getBaseUrl()), any(Instant.class));
        verify(repository).delete(instance);
    }

    @Test
    void listHidesArchivesUnlessRequestedAndDoesNotPollThem() throws Exception {
        instance.setArchivedAt(Instant.now());
        when(repository.findByTenantId(TENANT)).thenReturn(List.of(instance));
        mvc.perform(get("/api/instances")).andExpect(status().isOk()).andExpect(content().json("[]"));
        mvc.perform(get("/api/instances").param("includeArchived", "true"))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].archivedAt").isNotEmpty())
                .andExpect(jsonPath("$[0].id").value("inst_a"));
        verifyNoInteractions(n8n, crypto, alerts);
    }

    @Test
    void expiredArchiveCannotRestoreWhenAnotherInstanceUsesTheSlot() throws Exception {
        instance.setArchivedAt(Instant.now().minus(Duration.ofHours(7)));
        when(repository.countByTenantId(TENANT)).thenReturn(2L);
        when(repository.countByTenantIdAndArchivedAtLessThanEqual(eq(TENANT), any())).thenReturn(1L);
        mvc.perform(post("/api/instances/inst_a/restore"))
                .andExpect(status().isConflict()).andExpect(jsonPath("code").value("instance_limit_exceeded"));
        assertThat(instance.getArchivedAt()).isNotNull();
        assertThat(calls).isEmpty();
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void expiredArchiveReleasesCapacityForCreationOrRestoration(boolean restoring) throws Exception {
        when(repository.countByTenantId(TENANT)).thenReturn(1L);
        when(repository.countByTenantIdAndArchivedAtLessThanEqual(eq(TENANT), any())).thenReturn(1L);
        instance.setArchivedAt(Instant.now().minus(Duration.ofHours(7)));
        if (restoring) {
            mvc.perform(post("/api/instances/inst_a/restore")).andExpect(status().isOk());
        } else {
            mvc.perform(post("/api/instances").contentType(MediaType.APPLICATION_JSON)
                    .content("{\"name\":\"New\",\"baseUrl\":\"https://other.example.com\",\"apiKey\":\"key\"}"))
                    .andExpect(status().isCreated());
        }
    }

    @Test
    void archiveInsideLockStillOccupiesCapacity() throws Exception {
        when(repository.countByTenantId(TENANT)).thenReturn(1L);
        mvc.perform(post("/api/instances").contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"New\",\"baseUrl\":\"https://other.example.com\",\"apiKey\":\"key\"}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("code").value("instance_limit_exceeded"));
        verifyNoInteractions(crypto);
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void matchingUrlLockReportsAvailableAtAfterArchiveOrDeletion(boolean deleted) throws Exception {
        Instant since = Instant.now().minusSeconds(60);
        if (deleted) {
            when(repository.countReservedDeletedSlots(eq(TENANT), any())).thenReturn(1L);
            when(repository.latestSlotDeletion(TENANT, instance.getBaseUrl())).thenReturn(Optional.of(since));
        } else {
            instance.setArchivedAt(since);
            when(repository.countByTenantId(TENANT)).thenReturn(1L);
            when(repository.findByTenantIdAndArchivedAtIsNotNull(TENANT)).thenReturn(List.of(instance));
        }
        mvc.perform(post("/api/instances").contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"New\",\"baseUrl\":\"https://N8N.example.com:443/\",\"apiKey\":\"key\"}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("code").value("instance_slot_locked"))
                .andExpect(jsonPath("availableAt").exists());
        verifyNoInteractions(crypto);
    }

    @Test
    void matchingUrlIsAllowedWhenAnotherSlotIsAvailable() {
        when(license.getMaxInstances()).thenReturn(2);
        when(repository.countByTenantId(TENANT)).thenReturn(1L);
        assertThat(service.createInstance(new CreateInstanceDto("New", instance.getBaseUrl(), "key"))).isNotNull();
        verify(repository, never()).latestSlotDeletion(any(), any());
    }

    @Test
    void archivedStatusRefreshAndStaleSchedulerSnapshotCannotResumeMonitoring() {
        instance.setArchivedAt(Instant.now());
        service.updateInstanceStatus(instance);
        // Simulate an active snapshot fetched by the scheduler just before archive.
        Instance snapshot = new Instance();
        snapshot.setExternalId("inst_a");
        snapshot.setTenantId(TENANT);
        when(repository.findByArchivedAtIsNull()).thenReturn(List.of(snapshot));
        new InstanceStatusChecker(repository, service).checkInstances();
        verifyNoInteractions(n8n, alerts, crypto);
        verify(repository, never()).save(any(Instance.class));
    }

    @Test
    void deletedSchedulerSnapshotCannotReinsertInstance() {
        when(repository.findByExternalIdAndTenantId("inst_a", TENANT)).thenReturn(Optional.empty());
        service.refreshInstanceStatus("inst_a", TENANT);
        verify(repository, never()).save(any(Instance.class));
        verifyNoInteractions(n8n, alerts, crypto);
    }

    @Test
    void defaultAlertHandlerSkipsArchivedInstances() {
        instance.setArchivedAt(Instant.now());
        var settings = mock(de.atstck.controla.alerts.AlertSettingsRepository.class);
        var mail = mock(org.springframework.mail.javamail.JavaMailSender.class);
        var handler = new de.atstck.controla.alerts.DefaultInstanceAlertHandler(settings, mail);
        handler.handleInstanceOffline(instance);
        handler.handleInstanceOnline(instance);
        handler.handleInvalidApiKey(instance);
        handler.handleWorkflowError(instance, "Workflow", "Error");
        verifyNoInteractions(settings, mail);
    }
}
