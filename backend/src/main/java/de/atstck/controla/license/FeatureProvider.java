package de.atstck.controla.license;

import java.util.Collection;

/**
 * Extension point: every module reports the feature keys it implements.
 * The provider lives next to the code that implements the features, so a key
 * can only be reported by a backend that actually contains its endpoints.
 */
public interface FeatureProvider {
    Collection<FeatureDescriptor> features();
}
