package de.dgtlschmd.n8n.dto;

/**
 * DTO für das Erstellen einer neuen Instanz
 */
public class CreateInstanceDto {
    private String name;
    private String baseUrl;
    private String apiKey;

    public CreateInstanceDto() {
    }

    public CreateInstanceDto(String name, String baseUrl, String apiKey) {
        this.name = name;
        this.baseUrl = baseUrl;
        this.apiKey = apiKey;
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

    public String getApiKey() {
        return apiKey;
    }

    public void setApiKey(String apiKey) {
        this.apiKey = apiKey;
    }
}

