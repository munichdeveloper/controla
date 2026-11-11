package de.atstck.controla.license;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class LicenseConfigurationTest {

    private final ApplicationContextRunner context = new ApplicationContextRunner()
            .withUserConfiguration(LicenseConfiguration.class);

    @Test
    void communityBackendDefaultsToUnlimitedInstances() {
        context.run(application -> {
            assertThat(application).hasSingleBean(LicenseService.class);
            LicenseService license = application.getBean(LicenseService.class);
            assertThat(license).isInstanceOf(CommunityLicenseService.class);
            assertThat(license.getMaxInstances()).isEqualTo(-1);
            assertThat(license.getEditionName()).isEqualTo("Community Edition");
        });
    }

    @ParameterizedTest
    @ValueSource(ints = {10, 30, -1})
    void premiumModuleCanStillReplaceTheDefaultLicense(int limit) {
        LicenseService premium = mock(LicenseService.class);
        when(premium.getMaxInstances()).thenReturn(limit);
        context.withBean("premiumLicense", LicenseService.class, () -> premium).run(application -> {
            assertThat(application).hasSingleBean(LicenseService.class);
            assertThat(application.getBean(LicenseService.class)).isSameAs(premium);
            assertThat(application.getBean(LicenseService.class).getMaxInstances()).isEqualTo(limit);
        });
    }
}
