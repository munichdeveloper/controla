package de.atstck.controla.license;

import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.List;

/** Feature keys implemented by the Community backend. */
@Component
public class CommunityFeatures implements FeatureProvider {

    /** Diagnostic report of an instance: {@code GET /api/instances/{id}/diagnostics}. */
    public static final String DIAGNOSTICS_REPORT = "diagnostics.report";
    public static final String INSTANCES_ARCHIVE = "instances.archive";
    public static final String INSTANCES_DELETE = "instances.delete";

    @Override
    public Collection<FeatureDescriptor> features() {
        return List.of(FeatureDescriptor.community(DIAGNOSTICS_REPORT),
                FeatureDescriptor.community(INSTANCES_ARCHIVE), FeatureDescriptor.community(INSTANCES_DELETE));
    }
}
