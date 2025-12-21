package de.dgtlschmd.n8n.license;

public interface LicenseService {

    int getMaxInstances();

    String getEditionName();

    boolean isFeatureEnabled(String featureKey);
}

