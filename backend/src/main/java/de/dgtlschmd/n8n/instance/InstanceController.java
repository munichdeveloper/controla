package de.dgtlschmd.n8n.instance;

import de.dgtlschmd.n8n.dto.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

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
     * Liefert Liste aller Instanzen (max. 3 für CE)
     */
    @GetMapping
    public ResponseEntity<List<InstanceSummaryDto>> getInstances() {
        try {
            List<InstanceSummaryDto> instances = instanceService.getInstances();
            return ResponseEntity.ok(instances);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * POST /api/instances
     * Erstellt eine neue n8n-Instanz (max. 3 für CE)
     */
    @PostMapping
    public ResponseEntity<?> createInstance(@RequestBody CreateInstanceDto createDto) {
        try {
            // Prüfen ob bereits 3 Instanzen vorhanden (CE Limit)
            List<InstanceSummaryDto> existing = instanceService.getInstances();
            if (existing.size() >= 3) {
                return ResponseEntity.status(403).body("Community Edition: Maximal 3 Instanzen erlaubt");
            }

            InstanceSummaryDto created = instanceService.createInstance(createDto);
            return ResponseEntity.status(201).body(created);
        } catch (Exception e) {
            return ResponseEntity.status(400).body("Fehler beim Erstellen der Instanz: " + e.getMessage());
        }
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
