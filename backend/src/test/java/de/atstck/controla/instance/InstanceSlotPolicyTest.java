package de.atstck.controla.instance;

import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.core.env.MapPropertySource;

import java.time.Duration;
import java.util.Map;

import static org.assertj.core.api.Assertions.*;

class InstanceSlotPolicyTest {
    @Test
    void defaultReservationIsSixHours() {
        try (var context = context(null, null)) {
            assertThat(context.getBean(InstanceSlotPolicy.class).archiveSlotLock("tenant")).isEqualTo(Duration.ofHours(6));
        }
    }

    @Test
    void propertyOverridesReservationDuration() {
        try (var context = context("PT30M", null)) {
            assertThat(context.getBean(InstanceSlotPolicy.class).archiveSlotLock("tenant")).isEqualTo(Duration.ofMinutes(30));
        }
    }

    @Test
    void editionBeanReplacesDefaultAndMayVaryByTenant() {
        InstanceSlotPolicy policy = tenant -> tenant.equals("a") ? Duration.ZERO : Duration.ofHours(2);
        try (var context = context("PT30M", policy)) {
            assertThat(context.getBeansOfType(InstanceSlotPolicy.class)).hasSize(1);
            assertThat(context.getBean(InstanceSlotPolicy.class)).isSameAs(policy);
            assertThat(policy.archiveSlotLock("a")).isEqualTo(Duration.ZERO);
            assertThat(policy.archiveSlotLock("b")).isEqualTo(Duration.ofHours(2));
        }
    }

    private AnnotationConfigApplicationContext context(String duration, InstanceSlotPolicy policy) {
        var context = new AnnotationConfigApplicationContext();
        if (duration != null) context.getEnvironment().getPropertySources().addFirst(
                new MapPropertySource("test", Map.of("controla.instances.archive-slot-lock", duration)));
        if (policy != null) context.registerBean("editionSlotPolicy", InstanceSlotPolicy.class, () -> policy);
        context.register(InstanceLifecycleConfiguration.class);
        context.refresh();
        return context;
    }
}
