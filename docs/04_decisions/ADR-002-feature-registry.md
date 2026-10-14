# ADR-002: Feature registry as contract between frontend and backend

**Status:** Accepted
**Date:** 2026-10-14
**Decision Makers:** Development Team

## Context

The frontend serves two backends: the Community backend in this repository and a closed-source premium backend that embeds the Community backend as a library. The frontend decides via `GET /api/license` which functions to show.

Until version 1.1.0, `LicenseController` listed the feature keys itself, the Community license answered `false` for every key and the premium license `true` for every key. Consequences:

- A key added in the Community backend became `true` in the premium backend even before the premium backend had an endpoint for it – a button without endpoint.
- The premium backend could not report its own keys.
- The SaaS frontend can be newer than the premium backend, which embeds an older Community version; the frontend had no reliable way to detect whether a Community endpoint exists.

## Decision

1. **`FeatureProvider` extension point.** Every module reports the keys it implements (`FeatureDescriptor`: key, tier `COMMUNITY`/`PREMIUM`, `behaviorOnly`). The provider lives next to the implementing code.
2. **`FeatureRegistry`** collects all providers. `COMMUNITY` keys are always enabled, `PREMIUM` keys follow `LicenseService.isFeatureEnabled`. `GET /api/license` returns only keys of the running backend; the frontend treats a missing key as disabled.
3. **`@RequiresFeature`** marks the endpoints of a key. `FeatureGuardInterceptor` answers `404` while the key is not enabled.
4. **`FeatureContract`** check (unit test in every module): every key used in `@RequiresFeature` is reported, and every reported key that is not `behaviorOnly` has at least one endpoint.

The response format of `GET /api/license` is unchanged.

## Consequences

### Positive
- A key is `true` only where its endpoint exists – also when frontend and backend are deployed independently.
- The premium backend reports its keys without changes in the Community backend.
- Missing endpoints or orphaned keys fail the build via the contract test.

### Negative
- One more step when adding a feature: descriptor in the module's provider and `@RequiresFeature` on the endpoint.

### Neutral
- `isPremium` (comparison of the edition name) remains for existing UI gates; new gates use keys.

## Alternatives Considered

- **Keep the fixed list and let the premium license answer `true` per key:** still couples the Community release to premium endpoints.
- **Version negotiation between frontend and backend:** coarser and harder to maintain than per-feature keys.

## Implementation Notes

- `de.atstck.controla.license`: `FeatureTier`, `FeatureDescriptor`, `FeatureProvider`, `CommunityFeatures`, `FeatureRegistry`, `RequiresFeature`, `FeatureGuardInterceptor`, `FeatureWebConfig`, `FeatureContract`.
- First key: `diagnostics.report` for `GET /api/instances/{id}/diagnostics`.

## Related

- [ADR-001: Single Container Deployment](ADR-001-single-container-deployment.md)
- `AGENTS.md` → section "Feature Flags"
