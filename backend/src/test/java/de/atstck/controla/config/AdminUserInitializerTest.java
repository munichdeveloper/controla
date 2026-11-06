package de.atstck.controla.config;

import de.atstck.controla.security.CryptoService;
import de.atstck.controla.user.*;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.core.read.ListAppender;
import org.slf4j.LoggerFactory;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class AdminUserInitializerTest {
    @Test
    void requiresConfiguredPasswordOnlyForNewAdmin() throws Exception {
        var repo = mock(UserRepository.class);
        var initializer = new AdminUserInitializer();
        var runner = initializer.initAdminUser(repo, mock(PasswordEncoder.class), mock(CryptoService.class));
        assertThatThrownBy(() -> runner.run()).isInstanceOf(IllegalStateException.class);
        verify(repo, never()).save(any());
        when(repo.findByUsername("admin")).thenReturn(java.util.Optional.of(new User()));
        runner.run();
        verify(repo, never()).save(any());
    }

    @Test
    void usesConfiguredPasswordWithoutLoggingIt() throws Exception {
        String secret = java.util.UUID.randomUUID().toString();
        var repo = mock(UserRepository.class);
        var encoder = mock(PasswordEncoder.class);
        var initializer = new AdminUserInitializer();
        ReflectionTestUtils.setField(initializer, "initialAdminPassword", secret);
        var logs = new ListAppender<ch.qos.logback.classic.spi.ILoggingEvent>();
        var logger = (Logger) LoggerFactory.getLogger(AdminUserInitializer.class);
        logs.start(); logger.addAppender(logs);
        try {
            initializer.initAdminUser(repo, encoder, mock(CryptoService.class)).run();
            verify(encoder).encode(secret);
            verify(repo).save(any(User.class));
            assertThat(logs.list.stream().noneMatch(event -> event.getFormattedMessage().contains(secret))).isTrue();
        } finally { logger.detachAppender(logs); logs.stop(); }
    }
}
