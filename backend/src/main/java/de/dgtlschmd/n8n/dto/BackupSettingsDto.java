package de.dgtlschmd.n8n.dto;

import java.time.Instant;

public class BackupSettingsDto {
    private boolean enabled;
    private String googleDriveFolderId;
    private int intervalHours;
    private Instant lastBackupAt;

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getGoogleDriveFolderId() {
        return googleDriveFolderId;
    }

    public void setGoogleDriveFolderId(String googleDriveFolderId) {
        this.googleDriveFolderId = googleDriveFolderId;
    }

    public int getIntervalHours() {
        return intervalHours;
    }

    public void setIntervalHours(int intervalHours) {
        this.intervalHours = intervalHours;
    }

    public Instant getLastBackupAt() {
        return lastBackupAt;
    }

    public void setLastBackupAt(Instant lastBackupAt) {
        this.lastBackupAt = lastBackupAt;
    }
}

