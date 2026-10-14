package de.atstck.controla.security;

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class TargetPolicyConfiguration {

    @Bean
    @ConditionalOnMissingBean(InstanceTargetPolicy.class)
    public InstanceTargetPolicy instanceTargetPolicy() {
        return new AllowAllTargetPolicy();
    }
}
