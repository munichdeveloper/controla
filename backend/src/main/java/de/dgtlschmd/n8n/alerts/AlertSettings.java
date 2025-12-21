package de.dgtlschmd.n8n.alerts;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "alert_settings")
public class AlertSettings {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String email;

    @Column(nullable = false)
    private boolean enabled;

    @Column(name = "notify_on_instance_offline")
    private boolean notifyOnInstanceOffline;

    @Column(name = "notify_on_workflow_error")
    private boolean notifyOnWorkflowError;

    @Column(name = "notify_on_invalid_api_key")
    private boolean notifyOnInvalidApiKey;

    @Column(name = "extended_settings", columnDefinition = "TEXT")
    private String extendedSettings;

    @Column(name = "tenant_id", nullable = false, unique = true)
    private String tenantId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public boolean isNotifyOnInstanceOffline() {
        return notifyOnInstanceOffline;
    }

    public void setNotifyOnInstanceOffline(boolean notifyOnInstanceOffline) {
        this.notifyOnInstanceOffline = notifyOnInstanceOffline;
    }

    public boolean isNotifyOnWorkflowError() {
        return notifyOnWorkflowError;
    }

    public void setNotifyOnWorkflowError(boolean notifyOnWorkflowError) {
        this.notifyOnWorkflowError = notifyOnWorkflowError;
    }

    public boolean isNotifyOnInvalidApiKey() {
        return notifyOnInvalidApiKey;
    }

    public void setNotifyOnInvalidApiKey(boolean notifyOnInvalidApiKey) {
        this.notifyOnInvalidApiKey = notifyOnInvalidApiKey;
    }

    public String getExtendedSettings() {
        return extendedSettings;
    }

    public void setExtendedSettings(String extendedSettings) {
        this.extendedSettings = extendedSettings;
    }

    public String getTenantId() {
        return tenantId;
    }

    public void setTenantId(String tenantId) {
        this.tenantId = tenantId;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
