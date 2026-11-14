package de.atstck.controla.auth;

import de.atstck.controla.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class DebugControllerTest {
    private final ApplicationContextRunner context = new ApplicationContextRunner()
            .withBean(UserRepository.class, () -> mock(UserRepository.class))
            .withBean(PasswordEncoder.class, () -> mock(PasswordEncoder.class))
            .withUserConfiguration(DebugController.class);

    @Test
    void disabledUnlessExplicitlyEnabledForDevelopment() {
        context.run(result -> assertThat(result).doesNotHaveBean(DebugController.class));
        context.withPropertyValues("controla.debug.enabled=false")
                .run(result -> assertThat(result).doesNotHaveBean(DebugController.class));
    }

    @Test
    void availableWithExplicitDevelopmentOptIn() {
        context.withPropertyValues("controla.debug.enabled=true")
                .run(result -> assertThat(result).hasSingleBean(DebugController.class));
    }
}
