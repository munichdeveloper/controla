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

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
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

    public InstanceService(CoreApiClient coreApiClient, InstanceRepository instanceRepository, N8nApiClient n8nApiClient, CryptoService cryptoService, de.atstck.controla.license.LicenseService licenseService, de.atstck.controla.alerts.InstanceAlertHandler instanceAlertHandler) {
        this.coreApiClient = coreApiClient;
        this.instanceRepository = instanceRepository;
        this.n8nApiClient = n8nApiClient;
        this.cryptoService = cryptoService;
        this.licenseService = licenseService;
        this.instanceAlertHandler = instanceAlertHandler;
    }

    private String getDecryptedApiKey(Instance instance) {
        SecretKey key = cryptoService.getMasterKey();
        try {
            return cryptoService.decrypt(instance.getApiKey(), key);
        } catch (Exception e) {
            logger.warn("API key decryption failed, using stored value as fallback: tenantId={}, instanceId={}, instanceName={}",
                    instance.getTenantId(), instance.getExternalId(), instance.getName(), e);
            // Fallback: If decryption fails (e.g. legacy plaintext key or old user key), return raw key
            // This allows migration or re-entry of keys
            return instance.getApiKey();
        }
    }

    public List<InstanceSummaryDto> getInstances() {
        String tenantId = TenantContext.getTenantId();
        // Lade alle Instanzen aus der lokalen Datenbank für den aktuellen Tenant
        List<Instance> instances = instanceRepository.findByTenantId(tenantId);

        // Update status for all instances
        instances.forEach(this::updateInstanceStatus);
        instanceRepository.saveAll(instances);

        return instances.stream()
                .map(this::toSummaryDto)
                .toList();
    }

    public InstanceDetailDto getInstance(String id) {
        Instance instance = verifyOwnership(id);
        updateInstanceStatus(instance);
        instanceRepository.save(instance);
        return toDetailDto(instance);
    }

    public List<WorkflowDto> getInstanceWorkflows(String id) {
        Instance instance = verifyOwnership(id);
        String apiKey = getDecryptedApiKey(instance);
        if (apiKey == null) return Collections.emptyList();
        return n8nApiClient.getWorkflows(instance.getBaseUrl(), apiKey);
    }

    public List<EventDto> getInstanceEvents(String id, String type, Integer limit) {
        Instance instance = verifyOwnership(id);
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

        // Fetch errors with max allowed limit (250) for patterns
        List<EventDto> events = n8nApiClient.getExecutionErrors(instance.getBaseUrl(), apiKey, 250, since);

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

    public InstanceSummaryDto createInstance(CreateInstanceDto createDto) {
        String tenantId = TenantContext.getTenantId();

        // Check license limits
        int maxInstances = licenseService.getMaxInstances();
        if (maxInstances != -1) {
            long currentCount = instanceRepository.countByTenantId(tenantId);
            if (currentCount >= maxInstances) {
                throw new IllegalStateException("Maximale Anzahl an Instanzen (" + maxInstances + ") für " + licenseService.getEditionName() + " erreicht.");
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

    public InstanceSummaryDto updateInstance(String id, CreateInstanceDto updateDto) {
        Instance instance = verifyOwnership(id);
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

    public byte[] exportWorkflows(String id, List<String> workflowIds) {
        Instance instance = verifyOwnership(id);
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
                .orElseThrow(() -> new RuntimeException("Instance not found or access denied"));
    }

    private InstanceSummaryDto toSummaryDto(Instance instance) {
        InstanceSummaryDto dto = new InstanceSummaryDto();
        dto.setId(instance.getExternalId());
        dto.setName(instance.getName());
        dto.setBaseUrl(instance.getBaseUrl());
        dto.setStatus(instance.getStatus());
        dto.setVersion(instance.getVersion());

        String latest = n8nApiClient.getLatestN8nVersion();
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

        String latest = n8nApiClient.getLatestN8nVersion();
        dto.setLatestVersion(latest);

        dto.setLastSeenAt(instance.getLastSeenAt() != null ?
                instance.getLastSeenAt().atZone(systemDefault()).toInstant() : null);
        dto.setCreatedAt(instance.getCreatedAt() != null ?
                instance.getCreatedAt().atZone(systemDefault()).toInstant() : null);
        return dto;
    }

    public void updateInstanceStatus(Instance instance) {
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
