package de.atstck.controla.instance;

import de.atstck.controla.dto.*;
import de.atstck.controla.license.CommunityFeatures;
import de.atstck.controla.license.RequiresFeature;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;

/**
 * REST Controller für Instance-Endpoints.
 * Alle Endpoints unter /api/instances
 */
@RestController
@RequestMapping("/api/instances")
@CrossOrigin(origins = "*")
public class InstanceController {

    private final InstanceService instanceService;

    public InstanceController(InstanceService instanceService) {
        this.instanceService = instanceService;
    }

    /**
     * GET /api/instances
     * Liefert Liste aller Instanzen des aktuellen Tenants
     */
    @GetMapping
    public ResponseEntity<List<InstanceSummaryDto>> getInstances(
            @RequestParam(defaultValue = "false") boolean includeArchived) {
        try {
            List<InstanceSummaryDto> instances = instanceService.getInstances(includeArchived);
            return ResponseEntity.ok(instances);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    public ResponseEntity<List<InstanceSummaryDto>> getInstances() {
        return getInstances(false);
    }

    /**
     * POST /api/instances
     * Erstellt eine neue n8n-Instanz innerhalb des Limits der aktiven Lizenz
     */
    @PostMapping
    public ResponseEntity<?> createInstance(@RequestBody CreateInstanceDto createDto) {
        try {
            InstanceSummaryDto created = instanceService.createInstance(createDto);
            return ResponseEntity.status(201).body(created);
        } catch (InstanceLimitExceededException e) {
            return limitExceeded(e);
        } catch (InstanceSlotLockedException e) {
            return slotLocked(e);
        } catch (Exception e) {
            return ResponseEntity.status(400).body("Fehler beim Erstellen der Instanz: " + e.getMessage());
        }
    }

    @PostMapping("/{id}/archive")
    @RequiresFeature(CommunityFeatures.INSTANCES_ARCHIVE)
    public ResponseEntity<InstanceSummaryDto> archiveInstance(@PathVariable String id) {
        return ResponseEntity.ok(instanceService.archiveInstance(id));
    }

    @PostMapping("/{id}/restore")
    @RequiresFeature(CommunityFeatures.INSTANCES_ARCHIVE)
    public ResponseEntity<InstanceSummaryDto> restoreInstance(@PathVariable String id) {
        return ResponseEntity.ok(instanceService.restoreInstance(id));
    }

    @DeleteMapping("/{id}")
    @RequiresFeature(CommunityFeatures.INSTANCES_DELETE)
    public ResponseEntity<Void> deleteInstance(@PathVariable String id,
            @RequestBody(required = false) InstanceDeleteOptions options) {
        instanceService.deleteInstance(id, options == null ? InstanceDeleteOptions.DEFAULT : options);
        return ResponseEntity.noContent().build();
    }

    @ExceptionHandler(NoSuchElementException.class)
    public ResponseEntity<Void> instanceNotFound(NoSuchElementException exception) {
        return ResponseEntity.notFound().build();
    }

    @ExceptionHandler(InstanceLimitExceededException.class)
    public ResponseEntity<?> limitExceeded(InstanceLimitExceededException exception) {
        return ResponseEntity.status(409).body(Map.of("code", "instance_limit_exceeded", "message", exception.getMessage()));
    }

    @ExceptionHandler(InstanceSlotLockedException.class)
    public ResponseEntity<?> slotLocked(InstanceSlotLockedException exception) {
        return ResponseEntity.status(409).body(Map.of("code", "instance_slot_locked", "message", exception.getMessage(),
                "availableAt", exception.getAvailableAt()));
    }

    /**
     * PUT /api/instances/{id}
     * Aktualisiert eine bestehende Instanz (z.B. API Key)
     */
    @PutMapping("/{id}")
    public ResponseEntity<?> updateInstance(@PathVariable String id, @RequestBody CreateInstanceDto updateDto) {
        try {
            InstanceSummaryDto updated = instanceService.updateInstance(id, updateDto);
            return ResponseEntity.ok(updated);
        } catch (Exception e) {
            return ResponseEntity.status(400).body("Fehler beim Aktualisieren der Instanz: " + e.getMessage());
        }
    }

    /**
     * GET /api/instances/{id}
     * Liefert Detailinformationen für eine Instanz
     */
    @GetMapping("/{id}")
    public ResponseEntity<InstanceDetailDto> getInstance(@PathVariable String id) {
        try {
            InstanceDetailDto instance = instanceService.getInstance(id);
            return ResponseEntity.ok(instance);
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * GET /api/instances/{id}/workflows
     * Liefert Workflow-Übersicht für eine Instanz (read-only)
     */
    @GetMapping("/{id}/workflows")
    public ResponseEntity<List<WorkflowDto>> getInstanceWorkflows(@PathVariable String id) {
        try {
            List<WorkflowDto> workflows = instanceService.getInstanceWorkflows(id);
            return ResponseEntity.ok(workflows);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * GET /api/instances/{id}/events
     * Liefert Fehlerübersicht (Light), gefiltert auf WORKFLOW_ERROR
     * Query-Parameter: type, limit
     */
    @GetMapping("/{id}/events")
    public ResponseEntity<List<EventDto>> getInstanceEvents(
            @PathVariable String id,
            @RequestParam(required = false, defaultValue = "WORKFLOW_ERROR") String type,
            @RequestParam(required = false, defaultValue = "50") Integer limit) {
        try {
            List<EventDto> events = instanceService.getInstanceEvents(id, type, limit);
            return ResponseEntity.ok(events);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * GET /api/instances/{id}/error-patterns
     * Liefert aggregierte Fehlermuster
     * Query-Parameter: range (1d, 14d, 1m, 6m, 12m)
     */
    @GetMapping("/{id}/error-patterns")
    public ResponseEntity<List<ErrorPatternDto>> getInstanceErrorPatterns(
            @PathVariable String id,
            @RequestParam(required = false, defaultValue = "14d") String range) {
        try {
            List<ErrorPatternDto> patterns = instanceService.getInstanceErrorPatterns(id, range);
            return ResponseEntity.ok(patterns);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * GET /api/instances/{id}/export
     * Exportiert alle oder ausgewählte Workflows einer Instanz als ZIP
     * Query-Parameter: ids (optional, comma-separated)
     */
    @GetMapping(value = "/{id}/export", produces = "application/zip")
    public ResponseEntity<byte[]> exportWorkflows(
            @PathVariable String id,
            @RequestParam(required = false) List<String> ids) {
        try {
            byte[] zipData = instanceService.exportWorkflows(id, ids);
            return ResponseEntity.ok()
                    .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"workflows-" + id + ".zip\"")
                    .body(zipData);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }
}
