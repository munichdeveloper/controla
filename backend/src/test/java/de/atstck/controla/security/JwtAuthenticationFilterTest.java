package de.atstck.controla.security;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

class JwtAuthenticationFilterTest {
    private final JwtUtil jwt = new JwtUtil();
    private final CustomUserDetails alice = new CustomUserDetails(
            "alice", "unused", true, true, true, true, List.of(), "tenant-123");
    private final CustomUserDetailsService users = new CustomUserDetailsService(null) {
        @Override
        public UserDetails loadUserByUsername(String username) {
            if (!"alice".equals(username)) throw new UsernameNotFoundException(username);
            return alice;
        }
    };
    private final JwtAuthenticationFilter filter = new JwtAuthenticationFilter(jwt, users);

    @BeforeEach
    void configure() {
        ReflectionTestUtils.setField(jwt, "secret", JwtUtilTest.SECRET);
        ReflectionTestUtils.setField(jwt, "expiration", 86_400_000L);
    }

    @AfterEach
    void reset() {
        SecurityContextHolder.clearContext();
        TenantContext.clear();
    }

    /** Runs the filter and records what the rest of the chain would see. */
    private Seen run(String authorization) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/instances");
        if (authorization != null) request.addHeader("Authorization", authorization);
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicReference<Seen> seen = new AtomicReference<>();
        filter.doFilter(request, response, (req, res) -> seen.set(new Seen(
                SecurityContextHolder.getContext().getAuthentication() != null,
                TenantContext.getTenantId())));
        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(TenantContext.getTenantId()).as("tenant cleared after request").isEqualTo("default");
        return seen.get();
    }

    /** TenantContext reports "default" when no tenant is set. */
    record Seen(boolean authenticated, String tenantId) {}

    @Test
    void validTokenAuthenticatesAndSetsTenantForTheRequestOnly() throws Exception {
        Seen seen = run("Bearer " + jwt.generateToken(alice));
        assertThat(seen).isEqualTo(new Seen(true, "tenant-123"));
    }

    @Test
    void tokenIssuedByJjwt0123StillAuthenticates() throws Exception {
        Seen seen = run("Bearer " + JwtUtilTest.TOKEN_FROM_JJWT_0_12_3);
        assertThat(seen).isEqualTo(new Seen(true, "tenant-123"));
    }

    @Test
    void expiredTokenIsIgnoredWithoutError() throws Exception {
        ReflectionTestUtils.setField(jwt, "expiration", -60_000L);
        String expired = jwt.generateToken(alice);
        ReflectionTestUtils.setField(jwt, "expiration", 86_400_000L);
        assertThat(run("Bearer " + expired)).isEqualTo(new Seen(false, "default"));
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "Bearer not-a-jwt",
            "Bearer eyJhbGciOiJIUzM4NCJ9.e30.",
            "Bearer eyJhbGciOiJub25lIn0.eyJzdWIiOiJhbGljZSIsInRlbmFudElkIjoidGVuYW50LTEyMyJ9.",
            "Basic YWxpY2U6eA==",
    })
    void malformedUnsignedOrForeignTokensAreIgnoredWithoutError(String header) throws Exception {
        assertThat(run(header)).isEqualTo(new Seen(false, "default"));
    }

    @Test
    void tokenSignedWithAnotherKeyIsIgnored() throws Exception {
        ReflectionTestUtils.setField(jwt, "secret", "another-secret-key-min-32-chars-required-for-security");
        String foreign = jwt.generateToken(alice);
        ReflectionTestUtils.setField(jwt, "secret", JwtUtilTest.SECRET);
        assertThat(run("Bearer " + foreign)).isEqualTo(new Seen(false, "default"));
    }

    @Test
    void missingHeaderLeavesRequestAnonymous() throws Exception {
        assertThat(run(null)).isEqualTo(new Seen(false, "default"));
    }
}
