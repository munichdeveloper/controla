package de.atstck.controla.diagnostics;

import de.atstck.controla.diagnostics.checks.N8nApiAuthCheck;
import de.atstck.controla.diagnostics.checks.N8nExecutionErrorsCheck;
import de.atstck.controla.diagnostics.checks.N8nHealthCheck;
import de.atstck.controla.diagnostics.checks.N8nReachabilityCheck;
import de.atstck.controla.diagnostics.checks.N8nReadinessCheck;
import de.atstck.controla.diagnostics.checks.N8nTlsCheck;
import de.atstck.controla.instance.InstanceCredentialService;
import de.atstck.controla.instance.InstanceRepository;
import de.atstck.controla.license.CommunityFeatures;
import de.atstck.controla.license.CommunityLicenseService;
import de.atstck.controla.license.FeatureGuardInterceptor;
import de.atstck.controla.license.FeatureRegistry;
import de.atstck.controla.license.LicenseController;
import de.atstck.controla.license.LicenseService;
import de.atstck.controla.security.AllowAllTargetPolicy;
import de.atstck.controla.security.InstanceTargetPolicy;
import de.atstck.controla.security.TargetPolicyConfiguration;
import de.atstck.controla.service.InstanceHttpClient;
import de.atstck.controla.service.N8nApiClient;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;

import java.net.InetAddress;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

/** The new beans wire up in a Spring context (constructor selection, @Value defaults, conditional defaults). */
class DiagnosticsWiringTest {

    private static AnnotationConfigApplicationContext context(Class<?>... extra) {
        AnnotationConfigApplicationContext context = new AnnotationConfigApplicationContext();
        context.registerBean(InstanceRepository.class, () -> mock(InstanceRepository.class));
        context.registerBean(InstanceCredentialService.class, () -> mock(InstanceCredentialService.class));
        context.registerBean(N8nApiClient.class, () -> mock(N8nApiClient.class));
        context.registerBean(LicenseService.class, CommunityLicenseService::new);
        if (extra.length > 0) {
            context.register(extra);
        }
        context.register(TargetPolicyConfiguration.class, InstanceHttpClient.class, HttpProbe.class,
                N8nReachabilityCheck.class, N8nTlsCheck.class, N8nHealthCheck.class, N8nReadinessCheck.class,
                N8nApiAuthCheck.class, N8nExecutionErrorsCheck.class,
                InstanceDiagnosticsService.class, InstanceDiagnosticsController.class,
                CommunityFeatures.class, FeatureRegistry.class, FeatureGuardInterceptor.class, LicenseController.class);
        context.refresh();
        return context;
    }

    @Test
    void communityWiring() {
        try (AnnotationConfigApplicationContext context = context()) {
            assertThat(context.getBeansOfType(DiagnosticCheck.class)).hasSize(6);
            assertThat(context.getBean(InstanceTargetPolicy.class)).isInstanceOf(AllowAllTargetPolicy.class);
            assertThat(context.getBean(LicenseController.class).getLicenseInfo().get("features"))
                    .isEqualTo(Map.of("diagnostics.report", true));
        }
    }

    public static class BlockingPolicy implements InstanceTargetPolicy {
        @Override
        public boolean isAllowed(InetAddress address) {
            return false;
        }
    }

    @Test
    void anotherModulesPolicyReplacesTheDefault() {
        try (AnnotationConfigApplicationContext context = context(BlockingPolicy.class)) {
            assertThat(context.getBean(InstanceTargetPolicy.class)).isInstanceOf(BlockingPolicy.class);
            assertThat(context.getBean(InstanceHttpClient.class).policy()).isInstanceOf(BlockingPolicy.class);
        }
    }
}
