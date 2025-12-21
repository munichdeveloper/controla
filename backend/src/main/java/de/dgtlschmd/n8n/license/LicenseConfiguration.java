package de.dgtlschmd.n8n.license;

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class LicenseConfiguration {

    @Bean
    @ConditionalOnMissingBean(LicenseService.class)
    public LicenseService licenseService() {
        return new CommunityLicenseService();
    }
}

