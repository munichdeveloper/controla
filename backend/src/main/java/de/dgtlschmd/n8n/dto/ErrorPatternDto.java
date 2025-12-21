package de.dgtlschmd.n8n.dto;

import java.time.Instant;
import java.util.Set;

public class ErrorPatternDto {
    private String errorMessage;
    private long count;
    private Instant lastOccurred;
    private Set<String> affectedWorkflows;

    public ErrorPatternDto() {
    }

    public ErrorPatternDto(String errorMessage, long count, Instant lastOccurred, Set<String> affectedWorkflows) {
        this.errorMessage = errorMessage;
        this.count = count;
        this.lastOccurred = lastOccurred;
        this.affectedWorkflows = affectedWorkflows;
    }

    public String getErrorMessage() {
        return errorMessage;
    }

    public void setErrorMessage(String errorMessage) {
        this.errorMessage = errorMessage;
    }

    public long getCount() {
        return count;
    }

    public void setCount(long count) {
        this.count = count;
    }

    public Instant getLastOccurred() {
        return lastOccurred;
    }

    public void setLastOccurred(Instant lastOccurred) {
        this.lastOccurred = lastOccurred;
    }

    public Set<String> getAffectedWorkflows() {
        return affectedWorkflows;
    }

    public void setAffectedWorkflows(Set<String> affectedWorkflows) {
        this.affectedWorkflows = affectedWorkflows;
    }
}

