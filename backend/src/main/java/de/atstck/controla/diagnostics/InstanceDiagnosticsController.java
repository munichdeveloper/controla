package de.atstck.controla.diagnostics;

import de.atstck.controla.license.CommunityFeatures;
import de.atstck.controla.license.RequiresFeature;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.NoSuchElementException;

@RestController
@RequestMapping("/api/instances")
public class InstanceDiagnosticsController {

    private final InstanceDiagnosticsService diagnosticsService;

    public InstanceDiagnosticsController(InstanceDiagnosticsService diagnosticsService) {
        this.diagnosticsService = diagnosticsService;
    }

    /**
     * GET /api/instances/{id}/diagnostics
     * Runs all diagnostic checks of the running edition for the instance.
     */
    @GetMapping("/{id}/diagnostics")
    @RequiresFeature(CommunityFeatures.DIAGNOSTICS_REPORT)
    public ResponseEntity<?> getDiagnostics(@PathVariable String id) {
        try {
            return ResponseEntity.ok(diagnosticsService.runForCurrentTenant(id));
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(404).body(Map.of("error", "Instance not found"));
        }
    }
}
