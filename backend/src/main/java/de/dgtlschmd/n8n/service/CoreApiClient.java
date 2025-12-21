package de.dgtlschmd.n8n.service;

import de.dgtlschmd.n8n.config.CoreProperties;
import de.dgtlschmd.n8n.dto.*;
import de.dgtlschmd.n8n.security.TenantContext;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.*;

import static java.time.OffsetDateTime.now;

/**
 * Service für die Kommunikation mit der Agency Core API.
 * Fungiert als HTTP-Client und kümmert sich um Authorization und Fehlerbehandlung.
 * <p>
 * Basiert auf der Agency Core API Swagger Dokumentation (Port 8081).
 */
@Service
public class CoreApiClient {

    private final RestTemplate restTemplate;
    private final CoreProperties coreProperties;

    public CoreApiClient(CoreProperties coreProperties, RestTemplate restTemplate) {
        this.coreProperties = coreProperties;
        this.restTemplate = restTemplate;
    }

    /**
     * Erstellt Standard-Headers für Agency Core API Requests
     * Agency Core verwendet X-Api-Key und X-Tenant-Id Header
     */
    private HttpHeaders createHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Api-Key", coreProperties.getApiToken());

        String tenantId = TenantContext.getTenantId();
        if (tenantId != null) {
            headers.set("X-Tenant-Id", tenantId);
        } else {
            headers.set("X-Tenant-Id", coreProperties.getTenantId());
        }

        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setAccept(List.of(MediaType.APPLICATION_JSON));
        return headers;
    }

    /**
     * GET Request an Agency Core API
     */
    private <T> T get(String path, ParameterizedTypeReference<T> responseType) {
        try {
            String url = coreProperties.getBaseUrl() + path;
            HttpEntity<?> entity = new HttpEntity<>(createHeaders());
            ResponseEntity<T> response = restTemplate.exchange(url, HttpMethod.GET, entity, responseType);
            return response.getBody();
        } catch (HttpClientErrorException e) {
            throw new RuntimeException("CORE API error: " + e.getStatusCode() + " - " + e.getResponseBodyAsString(), e);
        } catch (Exception e) {
            throw new RuntimeException("Error communicating with CORE API: " + e.getMessage(), e);
        }
    }

    /**
     * POST Request an Agency Core API
     */
    private <T, R> R post(String path, T body, ParameterizedTypeReference<R> responseType) {
        try {
            String url = coreProperties.getBaseUrl() + path;
            HttpEntity<T> entity = new HttpEntity<>(body, createHeaders());
            ResponseEntity<R> response = restTemplate.exchange(url, HttpMethod.POST, entity, responseType);
            return response.getBody();
        } catch (HttpClientErrorException e) {
            throw new RuntimeException("CORE API error: " + e.getStatusCode() + " - " + e.getResponseBodyAsString(), e);
        } catch (Exception e) {
            throw new RuntimeException("Error communicating with CORE API: " + e.getMessage(), e);
        }
    }

    /**
     * POST Request ohne Response Body (z.B. 202 Accepted)
     */
    private <T> ResponseEntity<Void> postVoid(String path, T body) {
        try {
            String url = coreProperties.getBaseUrl() + path;
            HttpEntity<T> entity = new HttpEntity<>(body, createHeaders());
            return restTemplate.exchange(url, HttpMethod.POST, entity, Void.class);
        } catch (HttpClientErrorException e) {
            throw new RuntimeException("CORE API error: " + e.getStatusCode() + " - " + e.getResponseBodyAsString(), e);
        } catch (Exception e) {
            throw new RuntimeException("Error communicating with CORE API: " + e.getMessage(), e);
        }
    }

    /**
     * PATCH Request an Agency Core API
     */
    private <T, R> R patch(String path, T body, ParameterizedTypeReference<R> responseType) {
        try {
            String url = coreProperties.getBaseUrl() + path;
            HttpEntity<T> entity = new HttpEntity<>(body, createHeaders());
            ResponseEntity<R> response = restTemplate.exchange(url, HttpMethod.PATCH, entity, responseType);
            return response.getBody();
        } catch (HttpClientErrorException e) {
            throw new RuntimeException("CORE API error: " + e.getStatusCode() + " - " + e.getResponseBodyAsString(), e);
        } catch (Exception e) {
            throw new RuntimeException("Error communicating with CORE API: " + e.getMessage(), e);
        }
    }

    // ========================================================================
    // Events API
    // ========================================================================

    /**
     * POST /events - Event aufnehmen und asynchron verarbeiten
     *
     * @param eventData Event-Daten als Map (event_type, tenant_id, data, etc.)
     * @return ResponseEntity mit Status 202 (Accepted)
     */
    public ResponseEntity<Void> ingestEvent(Map<String, Object> eventData) {
        return postVoid("/events", eventData);
    }

    /**
     * GET /events/outbox - Warteschlangen-Events abrufen
     *
     * @return Liste von Outbox-Events
     */
    public List<Map<String, Object>> getOutboxEvents() {
        return get("/events/outbox", new ParameterizedTypeReference<>() {
        });
    }

    /**
     * PATCH /events/outbox/{id} - Event-Status aktualisieren
     *
     * @param id      Event-ID
     * @param updates Status-Updates
     * @return Aktualisiertes Event
     */
    public Map<String, Object> updateOutboxEvent(UUID id, Map<String, Object> updates) {
        return patch("/events/outbox/" + id, updates, new ParameterizedTypeReference<>() {
        });
    }

    // ========================================================================
    // Cases API
    // ========================================================================

    /**
     * GET /cases/{id} - Case anhand der ID abrufen
     *
     * @param id Case-ID
     * @return Case-Daten
     */
    public Map<String, Object> getCase(UUID id) {
        return get("/cases/" + id, new ParameterizedTypeReference<>() {
        });
    }

    /**
     * PATCH /cases/{id} - Case aktualisieren (Partial Update)
     *
     * @param id      Case-ID
     * @param updates Case-Updates
     * @return Aktualisierter Case
     */
    public Map<String, Object> updateCase(UUID id, Map<String, Object> updates) {
        return patch("/cases/" + id, updates, new ParameterizedTypeReference<>() {
        });
    }

    // ========================================================================
    // Journey Steps API
    // ========================================================================

    /**
     * GET /journey_steps - Journey-Schritt finden
     *
     * @param journeyId Journey-ID
     * @param stepKey   Step-Key
     * @return Journey-Schritt
     */
    public Map<String, Object> getJourneyStep(UUID journeyId, String stepKey) {
        String path = UriComponentsBuilder.fromPath("/journey_steps")
                .queryParam("journey_id", journeyId)
                .queryParam("step_key", stepKey)
                .toUriString();
        return get(path, new ParameterizedTypeReference<>() {
        });
    }

    /**
     * GET /journey_steps/previous - Vorherigen Journey-Schritt finden
     *
     * @param journeyId      Journey-ID
     * @param currentStepKey Aktueller Step-Key
     * @return Vorheriger Journey-Schritt
     */
    public Map<String, Object> getPreviousJourneyStep(UUID journeyId, String currentStepKey) {
        String path = UriComponentsBuilder.fromPath("/journey_steps/previous")
                .queryParam("journey_id", journeyId)
                .queryParam("step_key", currentStepKey)
                .toUriString();
        return get(path, new ParameterizedTypeReference<>() {
        });
    }

    /**
     * PATCH /journey_steps/{id} - Journey-Schritt aktualisieren
     *
     * @param id      Journey-Step-ID
     * @param updates Step-Updates
     * @return Aktualisierter Journey-Schritt
     */
    public Map<String, Object> updateJourneyStep(UUID id, Map<String, Object> updates) {
        return patch("/journey_steps/" + id, updates, new ParameterizedTypeReference<Map<String, Object>>() {
        });
    }

    // ========================================================================
    // Telemetry API
    // ========================================================================

    /**
     * POST /telemetry/ai-usage - AI-Usage Event erfassen
     *
     * @param usageData AI-Usage Daten
     * @return Response
     */
    public Map<String, Object> trackAiUsage(Map<String, Object> usageData) {
        return post("/telemetry/ai-usage", usageData, new ParameterizedTypeReference<Map<String, Object>>() {
        });
    }

    // ========================================================================
    // Tenant Communication Secrets API
    // ========================================================================

    /**
     * POST /tenants/{tenantId}/comm-secret/stage - Neues Secret vorbereiten
     *
     * @param tenantId   Tenant-ID
     * @param secretData Secret-Daten
     * @return Response
     */
    public Map<String, Object> stageCommSecret(UUID tenantId, Map<String, Object> secretData) {
        return post("/tenants/" + tenantId + "/comm-secret/stage", secretData,
                new ParameterizedTypeReference<>() {
                });
    }

    /**
     * POST /tenants/{tenantId}/comm-secret/promote - Vorbereitetes Secret aktivieren
     *
     * @param tenantId Tenant-ID
     * @return Response
     */
    public Map<String, Object> promoteCommSecret(UUID tenantId) {
        return post("/tenants/" + tenantId + "/comm-secret/promote", null,
                new ParameterizedTypeReference<Map<String, Object>>() {
                });
    }

    // ========================================================================
    // n8n-Spezifische Endpunkte (STUB - TODO: Implementierung)
    // ========================================================================
    // Diese Endpunkte existieren noch nicht in Agency Core API.
    // Sie werden als Stubs implementiert und geben Mock-Daten zurück.
    // In Zukunft können diese durch echte Core API Calls oder lokale Implementierungen ersetzt werden.

    /**
     * STUB: GET /instances - Liste aller n8n-Instanzen
     * TODO: Implementierung mit Agency Core oder lokale Speicherung
     */
    public List<InstanceSummaryDto> getInstances() {
        // STUB: Gibt leere Liste zurück, bis Endpunkt implementiert ist
        return new ArrayList<>();
    }

    /**
     * STUB: GET /instances/{id} - Details einer n8n-Instanz
     * TODO: Implementierung mit Agency Core oder lokale Speicherung
     */
    public InstanceDetailDto getInstance(String id) {
        // STUB: Gibt Mock-Daten zurück
        InstanceDetailDto dto = new InstanceDetailDto();
        dto.setId(id);
        dto.setName("Mock Instance");
        dto.setStatus("unknown");
        return dto;
    }


    /**
     * STUB: GET /instances/{id}/events - Events einer Instanz
     * TODO: Implementierung mit Agency Core Events API
     */
    public List<EventDto> getInstanceEvents(String id, String type, Integer limit) {
        // STUB: Könnte in Zukunft Agency Core Events API nutzen
        List<EventDto> events = new ArrayList<>();

        EventDto evt1 = new EventDto();
        evt1.setId("evt_1");
        evt1.setEventType("WORKFLOW_ERROR");
        evt1.setSeverity("ERROR");
        evt1.setOccurredAt(now().minusMinutes(15).toInstant());

        Map<String, Object> payload1 = new HashMap<>();
        payload1.put("workflowId", "wf_123");
        payload1.put("workflowName", "Lead Intake");
        payload1.put("errorMessage", "Request failed with status 401");
        payload1.put("node", "HTTP Request");
        evt1.setPayload(payload1);
        events.add(evt1);

        EventDto evt2 = new EventDto();
        evt2.setId("evt_2");
        evt2.setEventType("WORKFLOW_ERROR");
        evt2.setSeverity("WARNING");
        evt2.setOccurredAt(now().minusHours(2).toInstant());

        Map<String, Object> payload2 = new HashMap<>();
        payload2.put("workflowId", "wf_456");
        payload2.put("workflowName", "Data Sync");
        payload2.put("errorMessage", "JSON parameter needs to be valid JSON");
        payload2.put("node", "Edit Fields");
        evt2.setPayload(payload2);
        events.add(evt2);

        return events;
    }

    /**
     * STUB: GET /instances/{id}/metrics - Metriken einer Instanz
     * TODO: Implementierung mit Agency Core oder lokale Speicherung
     */
    public MetricsResponseDto getInstanceMetrics(String id, String type, String range) {
        // STUB: Gibt Mock-Daten zurück
        MetricsResponseDto dto = new MetricsResponseDto();
        dto.setMetricType(type);
        dto.setUnit("%");
        dto.setPoints(new ArrayList<>());
        return dto;
    }

    /**
     * STUB: GET /alerts/settings - Alert-Einstellungen
     * TODO: Implementierung mit Agency Core oder lokale Speicherung
     */
    public AlertSettingsDto getAlertSettings() {
        // STUB: Gibt Mock-Daten zurück
        AlertSettingsDto dto = new AlertSettingsDto();
        Map<String, Map<String, Object>> channels = new HashMap<>();
        Map<String, Object> emailConfig = new HashMap<>();
        emailConfig.put("address", "alerts@example.com");
        channels.put("email", emailConfig);
        dto.setChannels(channels);
        return dto;
    }

    /**
     * STUB: PUT /alerts/settings - Alert-Einstellungen aktualisieren
     * TODO: Implementierung mit Agency Core oder lokale Speicherung
     */
    public AlertSettingsDto updateAlertSettings(AlertSettingsDto settings) {
        // STUB: Gibt die übergebenen Settings zurück
        return settings;
    }
}