package de.atstck.controla.license;


public class CommunityLicenseService implements LicenseService {

    @Override
    public int getMaxInstances() {
        return -1;
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

