package de.dgtlschmd.n8n.license;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/license")
public class LicenseController {

    private final LicenseService licenseService;

    public LicenseController(LicenseService licenseService) {
        this.licenseService = licenseService;
    }

    @GetMapping
    public Map<String, Object> getLicenseInfo() {
        Map<String, Object> info = new HashMap<>();
        info.put("edition", licenseService.getEditionName());
        info.put("maxInstances", licenseService.getMaxInstances());

        Map<String, Boolean> features = new HashMap<>();
        features.put("alert.workflow_error", licenseService.isFeatureEnabled("alert.workflow_error"));
        features.put("alert.invalid_api_key", licenseService.isFeatureEnabled("alert.invalid_api_key"));

        info.put("features", features);
        return info;
    }
}

