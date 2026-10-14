package de.atstck.controla.license;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class FeatureRegistryTest {

    private static final FeatureProvider PREMIUM_MODULE = () -> List.of(
            FeatureDescriptor.premium("companion.diagnostics.logs"),
            FeatureDescriptor.premiumBehavior("alert.workflow_error"));

    @Test
    void communityFeaturesAreEnabledInCommunityEdition() {
        FeatureRegistry registry = new FeatureRegistry(List.of(new CommunityFeatures()), new CommunityLicenseService());

        assertThat(registry.resolve()).containsExactly(Map.entry("diagnostics.report", true));
    }

    @Test
    void premiumFeaturesFollowTheLicense() {
        LicenseService allEnabled = LicenseStubs.ALL_ENABLED;

        assertThat(new FeatureRegistry(List.of(new CommunityFeatures(), PREMIUM_MODULE), allEnabled).resolve())
                .containsEntry("diagnostics.report", true)
                .containsEntry("companion.diagnostics.logs", true)
                .containsEntry("alert.workflow_error", true);
        assertThat(new FeatureRegistry(List.of(new CommunityFeatures(), PREMIUM_MODULE), new CommunityLicenseService()).resolve())
                .containsEntry("diagnostics.report", true)
                .containsEntry("companion.diagnostics.logs", false);
    }

    @Test
    void keysWithoutProviderAreNeitherReportedNorEnabled() {
        FeatureRegistry registry = new FeatureRegistry(List.of(new CommunityFeatures()), LicenseStubs.ALL_ENABLED);

        assertThat(registry.resolve()).doesNotContainKey("companion.diagnostics.logs");
        assertThat(registry.isKnown("companion.diagnostics.logs")).isFalse();
        assertThat(registry.isEnabled("companion.diagnostics.logs")).isFalse();
    }
}
