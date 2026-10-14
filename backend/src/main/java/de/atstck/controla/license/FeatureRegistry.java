package de.atstck.controla.license;

import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Collects the feature keys of all {@link FeatureProvider}s and resolves them
 * against the license. A key is reported only when the running backend
 * contains its code; a missing key means "not available" to the frontend.
 */
@Component
public class FeatureRegistry {

    private final Map<String, FeatureDescriptor> descriptors;
    private final LicenseService licenseService;

    public FeatureRegistry(List<FeatureProvider> providers, LicenseService licenseService) {
        this.licenseService = licenseService;
        Map<String, FeatureDescriptor> collected = new LinkedHashMap<>();
        for (FeatureProvider provider : providers) {
            for (FeatureDescriptor descriptor : provider.features()) {
                FeatureDescriptor previous = collected.putIfAbsent(descriptor.key(), descriptor);
                if (previous != null && !previous.equals(descriptor)) {
                    // Bean order must not decide whether a key is COMMUNITY or PREMIUM.
                    throw new IllegalStateException("Feature key '" + descriptor.key()
                            + "' reported twice with different descriptors: " + previous + " / " + descriptor);
                }
            }
        }
        this.descriptors = Collections.unmodifiableMap(collected);
    }

    public Map<String, FeatureDescriptor> descriptors() {
        return descriptors;
    }

    public boolean isKnown(String key) {
        return descriptors.containsKey(key);
    }

    public boolean isEnabled(String key) {
        FeatureDescriptor descriptor = descriptors.get(key);
        if (descriptor == null) {
            return false;
        }
        return descriptor.tier() == FeatureTier.COMMUNITY || licenseService.isFeatureEnabled(key);
    }

    /** Key → enabled, for {@code GET /api/license}. */
    public Map<String, Boolean> resolve() {
        Map<String, Boolean> result = new LinkedHashMap<>();
        for (String key : descriptors.keySet()) {
            result.put(key, isEnabled(key));
        }
        return result;
    }
}
