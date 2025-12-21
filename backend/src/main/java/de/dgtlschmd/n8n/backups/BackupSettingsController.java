package de.dgtlschmd.n8n.backups;

import de.dgtlschmd.n8n.dto.BackupSettingsDto;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/backups/settings")
public class BackupSettingsController {

    @GetMapping
    public ResponseEntity<BackupSettingsDto> getSettings() {
        // In CE, return default/empty settings.
        // In Premium, this would fetch from DB/Service.
        BackupSettingsDto dto = new BackupSettingsDto();
        dto.setEnabled(false);
        dto.setIntervalHours(24);
        return ResponseEntity.ok(dto);
    }

    @PutMapping
    public ResponseEntity<BackupSettingsDto> updateSettings(@RequestBody BackupSettingsDto settings) {
        // In CE, this might be a no-op or throw an error if not licensed.
        // For now, we just echo back to satisfy the frontend.
        return ResponseEntity.ok(settings);
    }
}

