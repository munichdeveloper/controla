package de.atstck.controla.instance;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.convert.DurationStyle;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

@Configuration
public class InstanceLifecycleConfiguration {
    @Bean
    @ConditionalOnMissingBean(InstanceSlotPolicy.class)
    public InstanceSlotPolicy instanceSlotPolicy(
            @Value("${controla.instances.archive-slot-lock:PT6H}") String configuredDuration) {
        Duration duration = DurationStyle.detectAndParse(configuredDuration);
        if (duration.isNegative()) throw new IllegalArgumentException("archive-slot-lock must not be negative");
        return tenantId -> duration;
    }
}
