package de.atstck.controla.license;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

/** Rejects requests to endpoints whose {@link RequiresFeature} key is not enabled. */
@Component
public class FeatureGuardInterceptor implements HandlerInterceptor {

    private final FeatureRegistry featureRegistry;

    public FeatureGuardInterceptor(FeatureRegistry featureRegistry) {
        this.featureRegistry = featureRegistry;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        if (!(handler instanceof HandlerMethod handlerMethod)) {
            return true;
        }
        RequiresFeature annotation = requiredFeature(handlerMethod);
        if (annotation == null || featureRegistry.isEnabled(annotation.value())) {
            return true;
        }
        response.setStatus(HttpServletResponse.SC_NOT_FOUND);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.getWriter().write("{\"error\":\"Feature not available\",\"feature\":\"" + annotation.value() + "\"}");
        return false;
    }

    static RequiresFeature requiredFeature(HandlerMethod handlerMethod) {
        RequiresFeature onMethod = AnnotatedElementUtils.findMergedAnnotation(handlerMethod.getMethod(), RequiresFeature.class);
        if (onMethod != null) {
            return onMethod;
        }
        return AnnotatedElementUtils.findMergedAnnotation(handlerMethod.getBeanType(), RequiresFeature.class);
    }
}
