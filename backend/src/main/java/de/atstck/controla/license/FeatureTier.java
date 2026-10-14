package de.atstck.controla.license;

/**
 * Who may use a feature once its code is present.
 * COMMUNITY features are always enabled; PREMIUM features additionally need
 * {@link LicenseService#isFeatureEnabled(String)}.
 */
public enum FeatureTier {
    COMMUNITY,
    PREMIUM
}
