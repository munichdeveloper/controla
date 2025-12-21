package de.dgtlschmd.n8n.alerts;

import de.dgtlschmd.n8n.dto.AlertSettingsDto;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * REST Controller für Alert Settings.
 * Alle Endpoints unter /api/alerts
 */
@RestController
@RequestMapping("/api/alerts")
@CrossOrigin(origins = "*")
public class AlertSettingsController {

    private final AlertSettingsService alertSettingsService;

    public AlertSettingsController(AlertSettingsService alertSettingsService) {
        this.alertSettingsService = alertSettingsService;
    }

    /**
     * GET /api/alerts/settings
     * Liefert aktuelle Alert Settings
     */
    @GetMapping("/settings")
    public ResponseEntity<AlertSettingsDto> getAlertSettings() {
        try {
            AlertSettingsDto settings = alertSettingsService.getAlertSettings();
            return ResponseEntity.ok(settings);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * PUT /api/alerts/settings
     * Aktualisiert Alert Settings
     */
    @PutMapping("/settings")
    public ResponseEntity<?> updateAlertSettings(@RequestBody AlertSettingsDto settings) {
        try {
            AlertSettingsDto updated = alertSettingsService.updateAlertSettings(settings);
            return ResponseEntity.ok(updated);
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }
}

