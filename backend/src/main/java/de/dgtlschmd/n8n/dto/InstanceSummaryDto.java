package de.dgtlschmd.n8n.dto;

import java.time.Instant;

public class InstanceSummaryDto {
    private String id;
    private String name;
    private String baseUrl;
    private String status;
    private String version;
    private String latestVersion;
    private Instant lastSeenAt;

    public InstanceSummaryDto() {
    }

    public InstanceSummaryDto(String id, String name, String baseUrl, String status, String version, Instant lastSeenAt) {
        this.id = id;
        this.name = name;
        this.baseUrl = baseUrl;
        this.status = status;
        this.version = version;
        this.lastSeenAt = lastSeenAt;
    }

    public String getLatestVersion() {
        return latestVersion;
    }

    public void setLatestVersion(String latestVersion) {
        this.latestVersion = latestVersion;
    }


    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getBaseUrl() {
        return baseUrl;
    }

    public void setBaseUrl(String baseUrl) {
        this.baseUrl = baseUrl;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getVersion() {
        return version;
    }

    public void setVersion(String version) {
        this.version = version;
    }

    public Instant getLastSeenAt() {
        return lastSeenAt;
    }

    public void setLastSeenAt(Instant lastSeenAt) {
        this.lastSeenAt = lastSeenAt;
    }
}
