package de.atstck.controla.security;

import de.atstck.controla.auth.DebugController;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockServletContext;
import org.springframework.security.web.FilterChainProxy;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.support.AnnotationConfigWebApplicationContext;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;

class DebugEndpointSecurityTest {
    @org.springframework.context.annotation.Configuration
    @org.springframework.web.servlet.config.annotation.EnableWebMvc
    static class MvcConfig {}

    @Test
    void productionDeniesAnonymousDebugRequestsAndDoesNotRegisterController() throws Exception {
        try (var context = new AnnotationConfigWebApplicationContext()) {
            context.setServletContext(new MockServletContext());
            context.getEnvironment().setActiveProfiles("prod");
            context.getEnvironment().getSystemProperties().put("cors.allowed-origins", "http://localhost");
            context.register(SecurityConfig.class, DebugController.class, MvcConfig.class);
            context.addBeanFactoryPostProcessor(factory -> factory.registerSingleton("jwtAuthenticationFilter",
                    new JwtAuthenticationFilter(mock(JwtUtil.class), mock(CustomUserDetailsService.class))));
            try {
                context.refresh();
                assertThat(context.getBeansOfType(DebugController.class)).isEmpty();
                var mvc = MockMvcBuilders.webAppContextSetup(context)
                        .addFilters(context.getBean(FilterChainProxy.class)).build();
                for (var request : java.util.List.of(get("/api/debug/user/admin"),
                        post("/api/debug/verify-password"), post("/api/debug/generate-hash"),
                        get("/api/debug/unknown"))) {
                    int status = mvc.perform(request).andReturn().getResponse().getStatus();
                    assertThat(status).isIn(401, 403, 404);
                }
            } finally {
                context.getEnvironment().getSystemProperties().remove("cors.allowed-origins");
            }
        }
    }
}
