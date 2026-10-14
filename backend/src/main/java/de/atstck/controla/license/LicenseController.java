package de.atstck.controla.license;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/license")
public class LicenseController {

    private final LicenseService licenseService;
    private final FeatureRegistry featureRegistry;

    public LicenseController(LicenseService licenseService, FeatureRegistry featureRegistry) {
        this.licenseService = licenseService;
        this.featureRegistry = featureRegistry;
    }

    /**
     * Edition, instance limit and the features of the running backend.
     * {@code features} contains only keys whose code is present (see {@link FeatureRegistry});
     * the frontend treats a missing key as disabled.
     */
    @GetMapping
    public Map<String, Object> getLicenseInfo() {
        Map<String, Object> info = new HashMap<>();
        info.put("edition", licenseService.getEditionName());
        info.put("maxInstances", licenseService.getMaxInstances());
        info.put("features", featureRegistry.resolve());
        return info;
    }
}
