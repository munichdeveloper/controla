package de.atstck.controla.license;

import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.core.type.filter.AnnotationTypeFilter;
import org.springframework.util.ClassUtils;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;

/**
 * Verifies the contract between feature keys and endpoints, so the frontend
 * never shows a control without an endpoint behind it:
 * <ul>
 *   <li>every key used in {@link RequiresFeature} is reported by a {@link FeatureProvider},</li>
 *   <li>every reported key that is not {@code behaviorOnly} has at least one endpoint.</li>
 * </ul>
 * Used from tests of every module (CE and Premium).
 */
public final class FeatureContract {

    private FeatureContract() {
    }

    /** @return human-readable violations; empty when the contract holds */
    public static List<String> verify(Collection<FeatureProvider> providers, String... basePackages) {
        Map<String, FeatureDescriptor> reported = new HashMap<>();
        for (FeatureProvider provider : providers) {
            for (FeatureDescriptor descriptor : provider.features()) {
                reported.put(descriptor.key(), descriptor);
            }
        }

        Set<String> used = new TreeSet<>();
        for (Class<?> controller : controllers(basePackages)) {
            RequiresFeature onClass = AnnotatedElementUtils.findMergedAnnotation(controller, RequiresFeature.class);
            for (Method method : controller.getMethods()) {
                if (AnnotatedElementUtils.findMergedAnnotation(method, RequestMapping.class) == null) {
                    continue;
                }
                RequiresFeature onMethod = AnnotatedElementUtils.findMergedAnnotation(method, RequiresFeature.class);
                RequiresFeature effective = onMethod != null ? onMethod : onClass;
                if (effective != null) {
                    used.add(effective.value());
                }
            }
        }

        List<String> violations = new ArrayList<>();
        for (String key : used) {
            if (!reported.containsKey(key)) {
                violations.add("Endpoint requires feature '" + key + "', but no FeatureProvider reports it");
            }
        }
        for (FeatureDescriptor descriptor : new TreeSet<>(reported.keySet()).stream().map(reported::get).toList()) {
            if (!descriptor.behaviorOnly() && !used.contains(descriptor.key())) {
                violations.add("Feature '" + descriptor.key() + "' is reported, but no endpoint carries @RequiresFeature(\""
                        + descriptor.key() + "\") (mark it behaviorOnly if it has no endpoint)");
            }
        }
        return violations;
    }

    private static List<Class<?>> controllers(String... basePackages) {
        ClassPathScanningCandidateComponentProvider scanner = new ClassPathScanningCandidateComponentProvider(false);
        scanner.addIncludeFilter(new AnnotationTypeFilter(RestController.class));
        List<Class<?>> result = new ArrayList<>();
        for (String basePackage : basePackages) {
            for (BeanDefinition candidate : scanner.findCandidateComponents(basePackage)) {
                result.add(ClassUtils.resolveClassName(candidate.getBeanClassName(), FeatureContract.class.getClassLoader()));
            }
        }
        return result;
    }
}
