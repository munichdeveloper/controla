package de.atstck.controla.license;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.method.HandlerMethod;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class FeatureGuardInterceptorTest {

    static class SampleController {
        @RequiresFeature("companion.diagnostics.logs")
        public String guarded() {
            return "ok";
        }

        public String open() {
            return "ok";
        }
    }

    private static HandlerMethod handler(String name) throws NoSuchMethodException {
        return new HandlerMethod(new SampleController(), SampleController.class.getMethod(name));
    }

    @Test
    void rejectsDisabledFeatureWith404() throws Exception {
        FeatureProvider premium = () -> List.of(FeatureDescriptor.premium("companion.diagnostics.logs"));
        FeatureGuardInterceptor guard = new FeatureGuardInterceptor(
                new FeatureRegistry(List.of(premium), new CommunityLicenseService()));
        MockHttpServletResponse response = new MockHttpServletResponse();

        boolean proceed = guard.preHandle(new MockHttpServletRequest(), response, handler("guarded"));

        assertThat(proceed).isFalse();
        assertThat(response.getStatus()).isEqualTo(404);
        assertThat(response.getContentAsString()).contains("companion.diagnostics.logs");
    }

    @Test
    void rejectsUnknownFeature() throws Exception {
        FeatureGuardInterceptor guard = new FeatureGuardInterceptor(
                new FeatureRegistry(List.of(), LicenseStubs.ALL_ENABLED));

        assertThat(guard.preHandle(new MockHttpServletRequest(), new MockHttpServletResponse(), handler("guarded"))).isFalse();
    }

    @Test
    void passesEnabledFeatureAndUnannotatedHandlers() throws Exception {
        FeatureProvider premium = () -> List.of(FeatureDescriptor.premium("companion.diagnostics.logs"));
        FeatureGuardInterceptor guard = new FeatureGuardInterceptor(new FeatureRegistry(List.of(premium), LicenseStubs.ALL_ENABLED));

        assertThat(guard.preHandle(new MockHttpServletRequest(), new MockHttpServletResponse(), handler("guarded"))).isTrue();
        assertThat(guard.preHandle(new MockHttpServletRequest(), new MockHttpServletResponse(), handler("open"))).isTrue();
    }
}
