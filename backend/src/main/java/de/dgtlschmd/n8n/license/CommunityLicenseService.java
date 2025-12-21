package de.dgtlschmd.n8n.license;


public class CommunityLicenseService implements LicenseService {

    @Override
    public int getMaxInstances() {
        return 3;
    }

    @Override
    public String getEditionName() {
        return "Community Edition";
    }

    @Override
    public boolean isFeatureEnabled(String featureKey) {
        return false;
    }
}

