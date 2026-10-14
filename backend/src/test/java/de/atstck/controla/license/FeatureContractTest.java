package de.atstck.controla.license;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Every feature key of the Community backend has an endpoint, and every endpoint key is reported. */
class FeatureContractTest {

    @Test
    void communityContractHolds() {
        assertThat(FeatureContract.verify(List.of(new CommunityFeatures()), "de.atstck.controla")).isEmpty();
    }

    @Test
    void reportsKeysWithoutEndpointAndEndpointsWithoutKey() {
        FeatureProvider orphan = () -> List.of(FeatureDescriptor.premium("orphan.feature"));

        assertThat(FeatureContract.verify(List.of(orphan), "de.atstck.controla"))
                .anyMatch(v -> v.contains("'orphan.feature' is reported, but no endpoint"))
                .anyMatch(v -> v.contains("requires feature 'diagnostics.report', but no FeatureProvider reports it"));
    }

    @Test
    void behaviorOnlyKeysNeedNoEndpoint() {
        FeatureProvider behavior = () -> List.of(FeatureDescriptor.premiumBehavior("alert.workflow_error"));

        assertThat(FeatureContract.verify(List.of(new CommunityFeatures(), behavior), "de.atstck.controla")).isEmpty();
    }
}
