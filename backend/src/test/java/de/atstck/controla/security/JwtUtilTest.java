package de.atstck.controla.security;

import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.security.SignatureException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtUtilTest {
    private final JwtUtil jwt = new JwtUtil();
    private final CustomUserDetails user = new CustomUserDetails(
            "alice", "unused", true, true, true, true, List.of(), "tenant-123");

    @BeforeEach
    void configure() {
        ReflectionTestUtils.setField(jwt, "secret", "controla-secret-key-min-32-chars-required-for-security");
        ReflectionTestUtils.setField(jwt, "expiration", 86_400_000L);
    }

    @Test
    void roundTripPreservesUserAndTenant() {
        String token = jwt.generateToken(user);

        assertThat(jwt.extractUsername(token)).isEqualTo("alice");
        assertThat(jwt.extractTenantId(token)).isEqualTo("tenant-123");
        assertThat(jwt.validateToken(token, user)).isTrue();
    }

    @Test
    void rejectsTokensSignedByAnotherKey() {
        String token = jwt.generateToken(user);
        ReflectionTestUtils.setField(jwt, "secret", "another-secret-key-min-32-chars-required-for-security");

        assertThatThrownBy(() -> jwt.validateToken(token, user)).isInstanceOf(SignatureException.class);
    }

    @Test
    void rejectsExpiredTokens() {
        ReflectionTestUtils.setField(jwt, "expiration", -60_000L);
        String token = jwt.generateToken(user);

        assertThatThrownBy(() -> jwt.validateToken(token, user)).isInstanceOf(ExpiredJwtException.class);
    }
}
