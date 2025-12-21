package de.dgtlschmd.n8n.alerts;

import de.dgtlschmd.n8n.dto.AlertSettingsDto;
import de.dgtlschmd.n8n.security.TenantContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.type.TypeReference;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.Map;

@Service
public class AlertSettingsService {

    private final AlertSettingsRepository alertSettingsRepository;
    private final de.dgtlschmd.n8n.license.LicenseService licenseService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public AlertSettingsService(AlertSettingsRepository alertSettingsRepository, de.dgtlschmd.n8n.license.LicenseService licenseService) {
        this.alertSettingsRepository = alertSettingsRepository;
        this.licenseService = licenseService;
    }

    @Transactional(readOnly = true)
    public AlertSettingsDto getAlertSettings() {
        String tenantId = getTenantId();
        AlertSettings settings = alertSettingsRepository.findByTenantId(tenantId)
                .orElse(new AlertSettings());

        return mapToDto(settings);
    }

    @Transactional
    public AlertSettingsDto updateAlertSettings(AlertSettingsDto dto) {
        String tenantId = getTenantId();
        var settings = alertSettingsRepository.findByTenantId(tenantId).orElse(new AlertSettings());

        if (settings.getTenantId() == null) {
            settings.setTenantId(tenantId);
        }

        // Map Events
        Map<String, Boolean> events = dto.getEvents();
        if (events != null) {
            settings.setNotifyOnInstanceOffline(events.getOrDefault("instanceOffline", false));

            // Check License for Premium Features
            if (Boolean.TRUE.equals(events.get("workflowError"))) {
                if (licenseService.isFeatureEnabled("alert.workflow_error")) {
                    settings.setNotifyOnWorkflowError(true);
                } else {
                    throw new IllegalStateException("Workflow Error Alerts sind nur in der Business Edition verfügbar.");
                }
            } else {
                settings.setNotifyOnWorkflowError(false);
            }

            if (Boolean.TRUE.equals(events.get("invalidApiKey"))) {
                if (licenseService.isFeatureEnabled("alert.invalid_api_key")) {
                    settings.setNotifyOnInvalidApiKey(true);
                } else {
                    throw new IllegalStateException("Invalid API Key Alerts sind nur in der Business Edition verfügbar.");
                }
            } else {
                settings.setNotifyOnInvalidApiKey(false);
            }
        }

        // Map Channels
        Map<String, Map<String, Object>> channels = dto.getChannels();
        if (channels != null) {
            // Email Channel (Legacy/CE support)
            if (channels.containsKey("email")) {
                Map<String, Object> emailConfig = channels.get("email");
                settings.setEnabled(true);
                settings.setEmail((String) emailConfig.get("address"));
            } else {
                settings.setEnabled(false);
            }

            // Other Channels -> Extended Settings
            Map<String, Map<String, Object>> otherChannels = new HashMap<>(channels);
            otherChannels.remove("email"); // Remove email as it is stored in columns

            try {
                if (!otherChannels.isEmpty()) {
                    String json = objectMapper.writeValueAsString(otherChannels);
                    settings.setExtendedSettings(json);
                } else {
                    settings.setExtendedSettings(null);
                }
            } catch (Exception e) {
                throw new RuntimeException("Fehler beim Speichern der erweiterten Einstellungen", e);
            }
        }

        AlertSettings saved = alertSettingsRepository.save(settings);
        return mapToDto(saved);
    }

    private String getTenantId() {
        String tenantId = TenantContext.getTenantId();
        return tenantId != null ? tenantId : "default";
    }

    private AlertSettingsDto mapToDto(AlertSettings entity) {
        AlertSettingsDto dto = new AlertSettingsDto();

        // Map Events
        Map<String, Boolean> events = new HashMap<>();
        events.put("instanceOffline", entity.isNotifyOnInstanceOffline());
        events.put("workflowError", entity.isNotifyOnWorkflowError());
        events.put("invalidApiKey", entity.isNotifyOnInvalidApiKey());
        dto.setEvents(events);

        // Map Channels
        Map<String, Map<String, Object>> channels = new HashMap<>();

        // Email (from columns)
        if (entity.isEnabled() && entity.getEmail() != null) {
            Map<String, Object> emailConfig = new HashMap<>();
            emailConfig.put("address", entity.getEmail());
            channels.put("email", emailConfig);
        }

        // Extended Settings (other channels)
        try {
            if (entity.getExtendedSettings() != null) {
                Map<String, Map<String, Object>> extended = objectMapper.readValue(entity.getExtendedSettings(), new TypeReference<Map<String, Map<String, Object>>>() {});
                channels.putAll(extended);
            }
        } catch (Exception e) {
            // Ignore parsing errors
        }
        dto.setChannels(channels);

        return dto;
    }
}
