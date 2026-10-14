package de.atstck.controla.license;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class FeatureWebConfig implements WebMvcConfigurer {

    private final FeatureGuardInterceptor featureGuardInterceptor;

    public FeatureWebConfig(FeatureGuardInterceptor featureGuardInterceptor) {
        this.featureGuardInterceptor = featureGuardInterceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(featureGuardInterceptor);
    }
}
