package de.atstck.controla.license;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class LicenseControllerTest {

    @Test
    void responseKeepsItsFormatAndReportsRegistryFeatures() {
        CommunityLicenseService license = new CommunityLicenseService();
        LicenseController controller = new LicenseController(license,
                new FeatureRegistry(List.of(new CommunityFeatures()), license));

        Map<String, Object> info = controller.getLicenseInfo();

        assertThat(info).containsEntry("edition", "Community Edition").containsEntry("maxInstances", 3);
        assertThat(info.get("features")).isEqualTo(Map.of("diagnostics.report", true));
    }
}
