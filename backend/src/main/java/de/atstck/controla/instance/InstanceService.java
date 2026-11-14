package de.atstck.controla.instance;

import com.fasterxml.jackson.databind.ObjectMapper;
import de.atstck.controla.dto.*;
import de.atstck.controla.security.TenantContext;
import de.atstck.controla.service.CoreApiClient;
import de.atstck.controla.service.N8nApiClient;
import de.atstck.controla.security.CryptoService;
import javax.crypto.SecretKey;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import static java.time.ZoneId.*;

@Service
public class InstanceService {

    private static final Logger logger = LoggerFactory.getLogger(InstanceService.class);

    private final CoreApiClient coreApiClient;
    private final InstanceRepository instanceRepository;
    private final N8nApiClient n8nApiClient;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final CryptoService cryptoService;
    private final de.atstck.controla.license.LicenseService licenseService;
    private final de.atstck.controla.alerts.InstanceAlertHandler instanceAlertHandler;
    private final InstanceCredentialService credentialService;
    private InstanceSlotPolicy slotPolicy = tenantId -> Duration.ofHours(6);
    private List<InstanceLifecycleListener> lifecycleListeners = List.of();

    /** Configure contributions without changing the constructor used by existing editions. */
    public void configureLifecycle(InstanceSlotPolicy slotPolicy, List<InstanceLifecycleListener> listeners) {
        this.slotPolicy = slotPolicy;
        this.lifecycleListeners = List.copyOf(listeners);
    }

    @Autowired
    void wireLifecycle(InstanceSlotPolicy policy, ObjectProvider<InstanceLifecycleListener> listeners) {
        configureLifecycle(policy, listeners.orderedStream().toList());
    }

    public InstanceService(CoreApiClient coreApiClient, InstanceRepository instanceRepository, N8nApiClient n8nApiClient, CryptoService cryptoService, de.atstck.controla.license.LicenseService licenseService, de.atstck.controla.alerts.InstanceAlertHandler instanceAlertHandler, InstanceCredentialService credentialService) {
        this.coreApiClient = coreApiClient;
        this.instanceRepository = instanceRepository;
        this.n8nApiClient = n8nApiClient;
        this.cryptoService = cryptoService;
        this.licenseService = licenseService;
        this.instanceAlertHandler = instanceAlertHandler;
        this.credentialService = credentialService;
    }

    private String getDecryptedApiKey(Instance instance) {
        return credentialService.getDecryptedApiKey(instance);
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public List<InstanceSummaryDto> getInstances() {
        return getInstances(false);
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public List<InstanceSummaryDto> getInstances(boolean includeArchived) {
        String tenantId = TenantContext.getTenantId();
        instanceRepository.lockInstanceCreation(tenantId);
        // Lade alle Instanzen aus der lokalen Datenbank für den aktuellen Tenant
        List<Instance> instances = instanceRepository.findByTenantId(tenantId).stream()
                .filter(instance -> includeArchived || instance.getArchivedAt() == null).toList();

        // Update status for all instances
        instances.forEach(this::updateInstanceStatus);
        instanceRepository.saveAll(instances);

        return instances.stream()
                .map(this::toSummaryDto)
                .toList();
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public InstanceDetailDto getInstance(String id) {
        instanceRepository.lockInstanceCreation(TenantContext.getTenantId());
        Instance instance = verifyOwnership(id);
        updateInstanceStatus(instance);
        instanceRepository.save(instance);
        return toDetailDto(instance);
    }

    public List<WorkflowDto> getInstanceWorkflows(String id) {
        Instance instance = verifyOwnership(id);
        if (instance.getArchivedAt() != null) return Collections.emptyList();
        String apiKey = getDecryptedApiKey(instance);
        if (apiKey == null) return Collections.emptyList();
        return n8nApiClient.getWorkflows(instance.getBaseUrl(), apiKey);
    }

    public List<EventDto> getInstanceEvents(String id, String type, Integer limit) {
        Instance instance = verifyOwnership(id);
        if (instance.getArchivedAt() != null) return Collections.emptyList();
        String apiKey = getDecryptedApiKey(instance);
        if (apiKey == null) return Collections.emptyList();

        // Default-Werte für CE
        if (limit == null) {
            limit = 50;
        }
        // Use direct n8n API client to fetch execution errors
        return n8nApiClient.getExecutionErrors(instance.getBaseUrl(), apiKey, limit);
    }

    public List<ErrorPatternDto> getInstanceErrorPatterns(String id, String range) {
        Instance instance = verifyOwnership(id);
        if (instance.getArchivedAt() != null) return Collections.emptyList();
        String apiKey = getDecryptedApiKey(instance);
        if (apiKey == null) return Collections.emptyList();

        Instant since = Instant.now().minus(14, ChronoUnit.DAYS); // Default 14d
        if (range != null) {
            switch (range) {
                case "1d": since = Instant.now().minus(1, ChronoUnit.DAYS); break;
                case "1m": since = Instant.now().minus(30, ChronoUnit.DAYS); break;
                case "6m": since = Instant.now().minus(180, ChronoUnit.DAYS); break;
                case "12m": since = Instant.now().minus(365, ChronoUnit.DAYS); break;
            }
        }

        // Fetch errors with the max limit for requests that include execution data (100) for patterns
        List<EventDto> events = n8nApiClient.getExecutionErrors(instance.getBaseUrl(), apiKey, 100, since);

        // Aggregate
        Map<String, ErrorPatternDto> patterns = new HashMap<>();

        for (EventDto event : events) {
            String msg = (String) event.getPayload().get("errorMessage");
            String wfName = (String) event.getPayload().get("workflowName");

            if (msg == null) msg = "Unknown Error";

            ErrorPatternDto pattern = patterns.getOrDefault(msg, new ErrorPatternDto(msg, 0, Instant.MIN, new HashSet<>()));
            pattern.setCount(pattern.getCount() + 1);
            if (event.getOccurredAt().isAfter(pattern.getLastOccurred())) {
                pattern.setLastOccurred(event.getOccurredAt());
            }
            pattern.getAffectedWorkflows().add(wfName);
            patterns.put(msg, pattern);
        }

        return patterns.values().stream()
                .sorted(Comparator.comparingLong(ErrorPatternDto::getCount).reversed())
                .collect(Collectors.toList());
    }

    public MetricsResponseDto getInstanceMetrics(String id, String type, String range) {
        verifyOwnership(id);
        return coreApiClient.getInstanceMetrics(id, type, range);
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public InstanceSummaryDto createInstance(CreateInstanceDto createDto) {
        String tenantId = TenantContext.getTenantId();

        // Check license limits
        int maxInstances = licenseService.getMaxInstances();
        if (maxInstances != -1) {
            // Serialize admission across backend processes, including tenants with no instances yet.
            // Under READ_COMMITTED, the following count sees the preceding creator's commit.
            instanceRepository.lockInstanceCreation(tenantId);
            Instant now = Instant.now();
            long currentCount = occupiedSlots(tenantId, now);
            if (currentCount >= maxInstances) {
                Instant availableAt = lockedUrlAvailableAt(tenantId, createDto.getBaseUrl(), now);
                if (availableAt != null) throw new InstanceSlotLockedException(availableAt);
                throw new InstanceLimitExceededException(maxInstances, licenseService.getEditionName());
            }
        }

        SecretKey key = cryptoService.getMasterKey();
        String encryptedApiKey = cryptoService.encrypt(createDto.getApiKey(), key);

        // Neue Instanz erstellen
        Instance instance = new Instance();
        instance.setTenantId(tenantId);
        instance.setExternalId("inst_" + UUID.randomUUID().toString().substring(0, 8));
        instance.setName(createDto.getName());
        instance.setBaseUrl(createDto.getBaseUrl());
        instance.setApiKey(encryptedApiKey);
        instance.setStatus("unknown");
        instance.setVersion("unknown");
        instance.setLastSeenAt(LocalDateTime.now());

        Instance saved = instanceRepository.save(instance);

        // Als InstanceSummaryDto zurückgeben
        return toSummaryDto(saved);
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public InstanceSummaryDto updateInstance(String id, CreateInstanceDto updateDto) {
        instanceRepository.lockInstanceCreation(TenantContext.getTenantId());
        Instance instance = verifyOwnership(id);
        if (instance.getArchivedAt() != null) throw new IllegalStateException("Archivierte Instanzen können nicht bearbeitet werden.");
        String tenantId = TenantContext.getTenantId();

        if (updateDto.getName() != null) {
            instance.setName(updateDto.getName());
        }
        if (updateDto.getBaseUrl() != null) {
            instance.setBaseUrl(updateDto.getBaseUrl());
        }
        if (updateDto.getApiKey() != null && !updateDto.getApiKey().isEmpty()) {
            SecretKey key = cryptoService.getMasterKey();
            String encryptedApiKey = cryptoService.encrypt(updateDto.getApiKey(), key);
            instance.setApiKey(encryptedApiKey);
        }

        Instance saved = instanceRepository.save(instance);
        updateInstanceStatus(saved);
        return toSummaryDto(saved);
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public InstanceSummaryDto archiveInstance(String id) {
        instanceRepository.lockInstanceCreation(TenantContext.getTenantId());
        Instance instance = verifyOwnership(id);
        if (instance.getArchivedAt() == null) {
            instance.setArchivedAt(Instant.now());
            lifecycleListeners.forEach(listener -> listener.onArchived(instance));
            instanceRepository.save(instance);
        }
        return toSummaryDto(instance);
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public InstanceSummaryDto restoreInstance(String id) {
        String tenantId = TenantContext.getTenantId();
        instanceRepository.lockInstanceCreation(tenantId);
        Instance instance = verifyOwnership(id);
        if (instance.getArchivedAt() != null) {
            Instant now = Instant.now();
            int max = licenseService.getMaxInstances();
            // An archive within the lock period already reserves its own slot.
            long ownReservation = availableAt(tenantId, instance.getArchivedAt()).isAfter(now) ? 1 : 0;
            if (max != -1 && occupiedSlots(tenantId, now) - ownReservation >= max) {
                throw new InstanceLimitExceededException(max, licenseService.getEditionName());
            }
            instance.setArchivedAt(null);
            instance.setStatus("unknown");
            // Do not send alerts for errors accumulated while monitoring was paused.
            instance.setLastErrorCheck(LocalDateTime.now());
            lifecycleListeners.forEach(listener -> listener.onRestored(instance));
            instanceRepository.save(instance);
        }
        return toSummaryDto(instance);
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public void deleteInstance(String id, InstanceDeleteOptions options) {
        String tenantId = TenantContext.getTenantId();
        instanceRepository.lockInstanceCreation(tenantId);
        Instance instance = verifyOwnership(id);
        InstanceDeleteOptions effectiveOptions = options == null ? InstanceDeleteOptions.DEFAULT : options;
        lifecycleListeners.forEach(listener -> listener.beforeDelete(instance, effectiveOptions));
        instanceRepository.reserveDeletedSlot(tenantId, slotUrl(instance.getBaseUrl()), Instant.now());
        instanceRepository.delete(instance);
    }

    private Instant availableAt(String tenantId, Instant since) {
        return since.plus(slotPolicy.archiveSlotLock(tenantId));
    }

    private long occupiedSlots(String tenantId, Instant now) {
        Instant cutoff = now.minus(slotPolicy.archiveSlotLock(tenantId));
        return instanceRepository.countByTenantId(tenantId)
                - instanceRepository.countByTenantIdAndArchivedAtLessThanEqual(tenantId, cutoff)
                + instanceRepository.countReservedDeletedSlots(tenantId, cutoff);
    }

    private Instant lockedUrlAvailableAt(String tenantId, String baseUrl, Instant now) {
        String url = slotUrl(baseUrl);
        Instant archived = instanceRepository.findByTenantIdAndArchivedAtIsNotNull(tenantId).stream()
                .filter(instance -> slotUrl(instance.getBaseUrl()).equals(url))
                .map(Instance::getArchivedAt).max(Comparator.naturalOrder()).orElse(null);
        Instant deleted = instanceRepository.latestSlotDeletion(tenantId, url).orElse(null);
        Instant latest = archived == null ? deleted : deleted == null || archived.isAfter(deleted) ? archived : deleted;
        if (latest == null) return null;
        Instant until = availableAt(tenantId, latest);
        return until.isAfter(now) ? until : null;
    }

    private String slotUrl(String baseUrl) {
        String trimmed = baseUrl.trim();
        java.net.URI uri;
        try {
            uri = java.net.URI.create(trimmed).normalize();
        } catch (IllegalArgumentException exception) {
            // Legacy entries with malformed URLs must still be deletable.
            return trimmed;
        }
        if (uri.getScheme() == null || uri.getHost() == null) return trimmed;
        String scheme = uri.getScheme().toLowerCase(Locale.ROOT);
        int port = uri.getPort();
        String path = uri.getRawPath() == null ? "" : uri.getRawPath().replaceAll("/+$", "");
        return scheme + "://" + uri.getHost().toLowerCase(Locale.ROOT)
                + (port == -1 || (port == 443 && scheme.equals("https")) || (port == 80 && scheme.equals("http")) ? "" : ":" + port)
                + path + (uri.getRawQuery() == null ? "" : "?" + uri.getRawQuery());
    }

    @Scheduled(fixedDelay = 3600000)
    @Transactional
    public void cleanExpiredSlotLocks() {
        Instant now = Instant.now();
        for (String tenantId : instanceRepository.tenantsWithSlotLocks()) {
            instanceRepository.deleteExpiredSlotLocks(tenantId, now.minus(slotPolicy.archiveSlotLock(tenantId)));
        }
    }

    /** Re-read under the tenant lock so a stale scheduler snapshot cannot restore or reinsert an instance. */
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public void refreshInstanceStatus(String externalId, String tenantId) {
        instanceRepository.lockInstanceCreation(tenantId);
        instanceRepository.findByExternalIdAndTenantId(externalId, tenantId)
                .filter(instance -> instance.getArchivedAt() == null)
                .ifPresent(instance -> {
                    updateInstanceStatus(instance);
                    instanceRepository.save(instance);
                });
    }

    public byte[] exportWorkflows(String id, List<String> workflowIds) {
        Instance instance = verifyOwnership(id);
        if (instance.getArchivedAt() != null) throw new IllegalStateException("Die Überwachung dieser Instanz ist pausiert.");
        return exportWorkflows(instance, workflowIds);
    }

    public byte[] exportWorkflows(Instance instance, List<String> workflowIds) {
        String apiKey = getDecryptedApiKey(instance);
        if (apiKey == null) throw new RuntimeException("Instance locked");

        List<Map<String, Object>> workflows = n8nApiClient.getRawWorkflows(instance.getBaseUrl(), apiKey);

        if (workflowIds != null && !workflowIds.isEmpty()) {
            Set<String> idSet = new HashSet<>(workflowIds);
            workflows = workflows.stream()
                    .filter(wf -> idSet.contains(wf.get("id")))
                    .toList();
        }

        try (ByteArrayOutputStream baos = new ByteArrayOutputStream();
             ZipOutputStream zos = new ZipOutputStream(baos)) {

            for (Map<String, Object> wf : workflows) {
                String name = (String) wf.get("name");
                String wfId = (String) wf.get("id");
                // Sanitize filename
                String filename = (name != null ? name.replaceAll("[^a-zA-Z0-9.-]", "_") : "workflow") + "_" + wfId + ".json";

                ZipEntry entry = new ZipEntry(filename);
                zos.putNextEntry(entry);

                // Convert map to JSON string
                String json = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(wf);
                zos.write(json.getBytes(StandardCharsets.UTF_8));
                zos.closeEntry();
            }

            zos.finish();
            return baos.toByteArray();
        } catch (IOException e) {
            throw new RuntimeException("Failed to create zip export", e);
        }
    }

    private Instance verifyOwnership(String externalId) {
        String tenantId = TenantContext.getTenantId();
        return instanceRepository.findByExternalIdAndTenantId(externalId, tenantId)
                .orElseThrow(() -> new NoSuchElementException("Instance not found"));
    }

    private InstanceSummaryDto toSummaryDto(Instance instance) {
        InstanceSummaryDto dto = new InstanceSummaryDto();
        dto.setId(instance.getExternalId());
        dto.setName(instance.getName());
        dto.setBaseUrl(instance.getBaseUrl());
        dto.setStatus(instance.getStatus());
        dto.setVersion(instance.getVersion());
        dto.setArchivedAt(instance.getArchivedAt());
        dto.setSlotAvailableAt(instance.getArchivedAt() == null ? null : availableAt(instance.getTenantId(), instance.getArchivedAt()));

        String latest = instance.getArchivedAt() == null ? n8nApiClient.getLatestN8nVersion() : null;
        dto.setLatestVersion(latest);

        dto.setLastSeenAt(instance.getLastSeenAt() != null ?
                instance.getLastSeenAt().atZone(systemDefault()).toInstant() : null);
        return dto;
    }

    private InstanceDetailDto toDetailDto(Instance instance) {
        InstanceDetailDto dto = new InstanceDetailDto();
        dto.setId(instance.getExternalId());
        dto.setName(instance.getName());
        dto.setBaseUrl(instance.getBaseUrl());
        dto.setStatus(instance.getStatus());
        dto.setVersion(instance.getVersion());
        dto.setArchivedAt(instance.getArchivedAt());
        dto.setSlotAvailableAt(instance.getArchivedAt() == null ? null : availableAt(instance.getTenantId(), instance.getArchivedAt()));

        String latest = instance.getArchivedAt() == null ? n8nApiClient.getLatestN8nVersion() : null;
        dto.setLatestVersion(latest);

        dto.setLastSeenAt(instance.getLastSeenAt() != null ?
                instance.getLastSeenAt().atZone(systemDefault()).toInstant() : null);
        dto.setCreatedAt(instance.getCreatedAt() != null ?
                instance.getCreatedAt().atZone(systemDefault()).toInstant() : null);
        return dto;
    }

    public void updateInstanceStatus(Instance instance) {
        if (instance.getArchivedAt() != null) return;
        String oldStatus = instance.getStatus();
        String newStatus = oldStatus;
        boolean invalidApiKeyAlertTriggered = false;

        logger.debug("Starting updateInstanceStatus: tenantId={}, instanceId={}, instanceName={}, oldStatus={}",
                instance.getTenantId(), instance.getExternalId(), instance.getName(), oldStatus);

        try {
            String apiKey = getDecryptedApiKey(instance);
            if (apiKey == null) {
                newStatus = "locked";
                logger.warn("Instance status decision: API key unavailable -> locked. tenantId={}, instanceId={}, instanceName={}",
                        instance.getTenantId(), instance.getExternalId(), instance.getName());
            } else {
                var info = n8nApiClient.getSystemInfo(instance.getBaseUrl(), apiKey);
                String infoStatus = info.status();
                logger.debug("n8n system info fetched: tenantId={}, instanceId={}, instanceName={}, infoStatus={}, infoVersion={}",
                        instance.getTenantId(), instance.getExternalId(), instance.getName(), infoStatus, info.version());

                if ("auth_error".equals(infoStatus)) {
                    newStatus = "error";
                    invalidApiKeyAlertTriggered = true;
                    logger.warn("Instance status decision: auth_error -> error and alert handler. tenantId={}, instanceId={}, instanceName={}",
                            instance.getTenantId(), instance.getExternalId(), instance.getName());
                    instanceAlertHandler.handleInvalidApiKey(instance);
                } else {
                    newStatus = infoStatus;
                    logger.debug("Instance status decision: using info status '{}'. tenantId={}, instanceId={}, instanceName={}",
                            infoStatus, instance.getTenantId(), instance.getExternalId(), instance.getName());
                }

                if (!"unknown".equals(info.version())) {
                    instance.setVersion(info.version());
                    logger.debug("Instance version updated: tenantId={}, instanceId={}, instanceName={}, version={}",
                            instance.getTenantId(), instance.getExternalId(), instance.getName(), info.version());
                }
            }
        } catch (Exception e) {
            newStatus = "error";
            logger.error("Exception during status refresh -> setting status to error: tenantId={}, instanceId={}, instanceName={}",
                    instance.getTenantId(), instance.getExternalId(), instance.getName(), e);
        }

        if (!Objects.equals(oldStatus, newStatus)) {
            instance.setStatus(newStatus);
            logger.info("Instance status transition: tenantId={}, instanceId={}, instanceName={}, from={}, to={}",
                    instance.getTenantId(), instance.getExternalId(), instance.getName(), oldStatus, newStatus);

            // Alerts
            boolean shouldTriggerOfflineAlert =
                    ("offline".equals(newStatus) && ("online".equals(oldStatus) || "error".equals(oldStatus)))
                            || ("error".equals(newStatus) && "online".equals(oldStatus) && !invalidApiKeyAlertTriggered);

            if (shouldTriggerOfflineAlert) {
                logger.info("Triggering offline alert: tenantId={}, instanceId={}, instanceName={}, previousStatus={}, currentStatus={}",
                        instance.getTenantId(), instance.getExternalId(), instance.getName(), oldStatus, newStatus);
                instanceAlertHandler.handleInstanceOffline(instance);
            } else if ("online".equals(newStatus) && ("offline".equals(oldStatus) || "error".equals(oldStatus))) {
                logger.info("Triggering online alert: tenantId={}, instanceId={}, instanceName={}, previousStatus={}",
                        instance.getTenantId(), instance.getExternalId(), instance.getName(), oldStatus);
                instanceAlertHandler.handleInstanceOnline(instance);
            }
        } else {
            logger.debug("Instance status unchanged: tenantId={}, instanceId={}, instanceName={}, status={}",
                    instance.getTenantId(), instance.getExternalId(), instance.getName(), newStatus);
        }

        if ("online".equals(newStatus)) {
            instance.setLastSeenAt(LocalDateTime.now());
            logger.debug("Instance marked online, updating lastSeenAt and checking workflow errors: tenantId={}, instanceId={}, instanceName={}",
                    instance.getTenantId(), instance.getExternalId(), instance.getName());
            checkWorkflowErrors(instance);
        } else {
            logger.debug("Skipping workflow error check because status is not online: tenantId={}, instanceId={}, instanceName={}, status={}",
                    instance.getTenantId(), instance.getExternalId(), instance.getName(), newStatus);
        }

        logger.debug("Finished updateInstanceStatus: tenantId={}, instanceId={}, instanceName={}, finalStatus={}",
                instance.getTenantId(), instance.getExternalId(), instance.getName(), instance.getStatus());
    }

    private void checkWorkflowErrors(Instance instance) {
        try {
            logger.debug("Starting workflow error check: tenantId={}, instanceId={}, instanceName={}, lastErrorCheck={}",
                    instance.getTenantId(), instance.getExternalId(), instance.getName(), instance.getLastErrorCheck());
            String apiKey = getDecryptedApiKey(instance);
            if (apiKey == null) {
                logger.warn("Skipping workflow error check because API key is unavailable: tenantId={}, instanceId={}, instanceName={}",
                        instance.getTenantId(), instance.getExternalId(), instance.getName());
                return;
            }

            // Determine time range: since last check or default to last 10 minutes if never checked
            Instant since = instance.getLastErrorCheck() != null ?
                    instance.getLastErrorCheck().atZone(systemDefault()).toInstant() :
                    Instant.now().minus(10, ChronoUnit.MINUTES);
            logger.debug("Workflow error check time window: tenantId={}, instanceId={}, instanceName={}, since={}",
                    instance.getTenantId(), instance.getExternalId(), instance.getName(), since);

            // Fetch errors
            List<EventDto> errors = n8nApiClient.getExecutionErrors(instance.getBaseUrl(), apiKey, 50, since);
            logger.debug("Workflow error check fetched {} error event(s): tenantId={}, instanceId={}, instanceName={}",
                    errors.size(), instance.getTenantId(), instance.getExternalId(), instance.getName());

            if (!errors.isEmpty()) {
                for (EventDto error : errors) {
                    String wfName = (String) error.getPayload().get("workflowName");
                    String msg = (String) error.getPayload().get("errorMessage");
                    logger.info("Forwarding workflow error to alert handler: tenantId={}, instanceId={}, instanceName={}, workflowName={}, occurredAt={}",
                            instance.getTenantId(), instance.getExternalId(), instance.getName(), wfName, error.getOccurredAt());
                    instanceAlertHandler.handleWorkflowError(instance, wfName, msg);
                }
            } else {
                logger.debug("No workflow errors found: tenantId={}, instanceId={}, instanceName={}",
                        instance.getTenantId(), instance.getExternalId(), instance.getName());
            }

            // Update last check time
            instance.setLastErrorCheck(LocalDateTime.now());
            logger.debug("Finished workflow error check: tenantId={}, instanceId={}, instanceName={}, newLastErrorCheck={}",
                    instance.getTenantId(), instance.getExternalId(), instance.getName(), instance.getLastErrorCheck());
        } catch (Exception e) {
            // Log error but don't fail status update
            logger.error("Failed to check workflow errors: tenantId={}, instanceId={}, instanceName={}",
                    instance.getTenantId(), instance.getExternalId(), instance.getName(), e);
        }
    }
}
