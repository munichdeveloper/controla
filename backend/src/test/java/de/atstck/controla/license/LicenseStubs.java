package de.atstck.controla.license;

final class LicenseStubs {

    private LicenseStubs() {
    }

    static final LicenseService ALL_ENABLED = new LicenseService() {
        @Override
        public int getMaxInstances() {
            return -1;
        }

        @Override
        public String getEditionName() {
            return "Premium Edition";
        }

        @Override
        public boolean isFeatureEnabled(String featureKey) {
            return true;
        }
    };
}
