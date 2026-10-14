package de.atstck.controla.license;

import java.util.Objects;

/**
 * A feature key reported to the frontend via {@code GET /api/license}.
 *
 * @param key          key in the form {@code area.function}
 * @param tier         community or premium
 * @param behaviorOnly true when the key only switches behavior and has no endpoint
 *                     of its own (e.g. {@code alert.workflow_error}); otherwise at
 *                     least one endpoint must carry {@link RequiresFeature} with this key
 */
public record FeatureDescriptor(String key, FeatureTier tier, boolean behaviorOnly) {

    public FeatureDescriptor {
        Objects.requireNonNull(key, "key");
        Objects.requireNonNull(tier, "tier");
    }

    public static FeatureDescriptor community(String key) {
        return new FeatureDescriptor(key, FeatureTier.COMMUNITY, false);
    }

    public static FeatureDescriptor premium(String key) {
        return new FeatureDescriptor(key, FeatureTier.PREMIUM, false);
    }

    public static FeatureDescriptor premiumBehavior(String key) {
        return new FeatureDescriptor(key, FeatureTier.PREMIUM, true);
    }
}
