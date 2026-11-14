package de.atstck.controla.security;

import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.MalformedJwtException;
import io.jsonwebtoken.security.SignatureException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtUtilTest {
    static final String SECRET = "controla-secret-key-min-32-chars-required-for-security";

    /**
     * Issued by JJWT 0.12.3 with {@link #SECRET} for alice/tenant-123, expiring in 2126.
     * Sessions created before the 0.13 upgrade must stay valid.
     */
    static final String TOKEN_FROM_JJWT_0_12_3 =
            "eyJhbGciOiJIUzM4NCJ9.eyJ0ZW5hbnRJZCI6InRlbmFudC0xMjMiLCJzdWIiOiJhbGljZSIsImlhdCI6MTc5NDYxNzk4MSwiZXhwIjo0OTQ4MjE3OTgxfQ.gnuobNFGJEAzkYfImGuhaOcNqQXfMuH1kjq0u_itv0vEutrJhOqBTPEE353qbUM4";

    private final JwtUtil jwt = new JwtUtil();
    private final CustomUserDetails user = new CustomUserDetails(
            "alice", "unused", true, true, true, true, List.of(), "tenant-123");

    @BeforeEach
    void configure() {
        ReflectionTestUtils.setField(jwt, "secret", SECRET);
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
    void acceptsTokensIssuedBeforeTheUpgrade() {
        assertThat(jwt.extractUsername(TOKEN_FROM_JJWT_0_12_3)).isEqualTo("alice");
        assertThat(jwt.extractTenantId(TOKEN_FROM_JJWT_0_12_3)).isEqualTo("tenant-123");
        assertThat(jwt.validateToken(TOKEN_FROM_JJWT_0_12_3, user)).isTrue();
    }

    @Test
    void rejectsTokensSignedByAnotherKey() {
        String token = jwt.generateToken(user);
        ReflectionTestUtils.setField(jwt, "secret", "another-secret-key-min-32-chars-required-for-security");

        assertThatThrownBy(() -> jwt.validateToken(token, user)).isInstanceOf(SignatureException.class);
    }

    @Test
    void rejectsTamperedPayload() {
        // Same token with tenantId changed to tenant-999, original signature kept.
        String[] parts = TOKEN_FROM_JJWT_0_12_3.split("\\.");
        String forgedPayload = "eyJ0ZW5hbnRJZCI6InRlbmFudC05OTkiLCJzdWIiOiJhbGljZSIsImlhdCI6MTc5NDYxNzk4MSwiZXhwIjo0OTQ4MjE3OTgxfQ";
        String forged = parts[0] + "." + forgedPayload + "." + parts[2];

        assertThatThrownBy(() -> jwt.extractTenantId(forged)).isInstanceOf(SignatureException.class);
    }

    @Test
    void rejectsExpiredTokens() {
        ReflectionTestUtils.setField(jwt, "expiration", -60_000L);
        String token = jwt.generateToken(user);

        assertThatThrownBy(() -> jwt.validateToken(token, user)).isInstanceOf(ExpiredJwtException.class);
    }

    @Test
    void rejectsMalformedTokens() {
        assertThatThrownBy(() -> jwt.extractUsername("not-a-jwt")).isInstanceOf(MalformedJwtException.class);
    }
}
