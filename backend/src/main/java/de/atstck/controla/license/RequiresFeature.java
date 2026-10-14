package de.atstck.controla.license;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Marks a controller method (or class) as belonging to a feature key.
 * {@link FeatureGuardInterceptor} answers 404 while the key is not enabled,
 * and the feature contract check ({@link FeatureContract}) verifies that every
 * reported key has an endpoint and every annotated key is reported.
 */
@Target({ElementType.METHOD, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
public @interface RequiresFeature {
    String value();
}
