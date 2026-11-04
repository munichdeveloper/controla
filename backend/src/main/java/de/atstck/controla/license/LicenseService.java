package de.atstck.controla.license;

public interface LicenseService {

    /** @return the maximum number of instances per tenant, or {@code -1} for unlimited instances */
    int getMaxInstances();

    String getEditionName();

    boolean isFeatureEnabled(String featureKey);
}

