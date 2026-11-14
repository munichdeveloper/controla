package de.atstck.controla.license;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class FeatureRegistryTest {

    private static final FeatureProvider PREMIUM_MODULE = () -> List.of(
            FeatureDescriptor.premium("companion.diagnostics.logs"),
            FeatureDescriptor.premiumBehavior("alert.workflow_error"));

    @Test
    void communityFeaturesAreEnabledInCommunityEdition() {
        FeatureRegistry registry = new FeatureRegistry(List.of(new CommunityFeatures()), new CommunityLicenseService());

        assertThat(registry.resolve()).containsOnly(Map.entry("diagnostics.report", true),
                Map.entry("instances.archive", true), Map.entry("instances.delete", true));
    }

    @Test
    void unlimitedCommunityCapacityDoesNotGrantPaidFeatures() {
        FeatureProvider paidFeatures = () -> List.of(
                FeatureDescriptor.premium("workflow.import"),
                FeatureDescriptor.premium("backup.scheduled"),
                FeatureDescriptor.premium("companion.manage"),
                FeatureDescriptor.premium("companion.diagnostics.logs"),
                FeatureDescriptor.premiumBehavior("alert.workflow_error"),
                FeatureDescriptor.premiumBehavior("alert.api_key_invalid"));
        CommunityLicenseService community = new CommunityLicenseService();
        FeatureRegistry registry = new FeatureRegistry(List.of(new CommunityFeatures(), paidFeatures), community);

        assertThat(community.getMaxInstances()).isEqualTo(-1);
        assertThat(registry.resolve()).containsEntry("diagnostics.report", true);
        for (FeatureDescriptor feature : paidFeatures.features()) {
            assertThat(registry.isEnabled(feature.key())).as(feature.key()).isFalse();
        }
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

    @Test
    void conflictingDescriptorsForTheSameKeyFailAtStartup() {
        FeatureProvider communityClaim = () -> List.of(FeatureDescriptor.community("companion.diagnostics.logs"));

        assertThatThrownBy(() -> new FeatureRegistry(List.of(communityClaim, PREMIUM_MODULE), LicenseStubs.ALL_ENABLED))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("companion.diagnostics.logs");
    }
}
