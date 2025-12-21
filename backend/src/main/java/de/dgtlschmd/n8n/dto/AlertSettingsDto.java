package de.dgtlschmd.n8n.dto;

import java.util.HashMap;
import java.util.Map;

public class AlertSettingsDto {
    private Map<String, Boolean> events = new HashMap<>();
    private Map<String, Map<String, Object>> channels = new HashMap<>();

    public AlertSettingsDto() {
    }

    public Map<String, Boolean> getEvents() {
        return events;
    }

    public void setEvents(Map<String, Boolean> events) {
        this.events = events;
    }

    public Map<String, Map<String, Object>> getChannels() {
        return channels;
    }

    public void setChannels(Map<String, Map<String, Object>> channels) {
        this.channels = channels;
    }
}
