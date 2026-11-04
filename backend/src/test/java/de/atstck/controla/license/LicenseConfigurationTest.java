package de.atstck.controla.license;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class LicenseConfigurationTest {

    private final ApplicationContextRunner context = new ApplicationContextRunner()
            .withUserConfiguration(LicenseConfiguration.class);

    @Test
    void communityBackendAlwaysDefaultsToThreeInstances() {
        context.run(application -> {
            assertThat(application).hasSingleBean(LicenseService.class);
            LicenseService license = application.getBean(LicenseService.class);
            assertThat(license).isInstanceOf(CommunityLicenseService.class);
            assertThat(license.getMaxInstances()).isEqualTo(3);
            assertThat(license.getEditionName()).isEqualTo("Community Edition");
        });
    }

    @Test
    void premiumModuleCanStillReplaceTheDefaultLicense() {
        LicenseService premium = mock(LicenseService.class);
        when(premium.getMaxInstances()).thenReturn(-1);
        context.withBean("premiumLicense", LicenseService.class, () -> premium).run(application -> {
            assertThat(application).hasSingleBean(LicenseService.class);
            assertThat(application.getBean(LicenseService.class)).isSameAs(premium);
            assertThat(application.getBean(LicenseService.class).getMaxInstances()).isEqualTo(-1);
        });
    }
}
