# ADR-003: Open core – Apache-2.0 Community Edition and CE/Premium boundary

**Status:** Accepted
**Date:** 2026-11-14
**Decision Makers:** Project owner (license and product direction, approved 2026-11-06)
**Tracking:** [#47](https://github.com/munichdeveloper/controla/issues/47) · legal follow-up [#49](https://github.com/munichdeveloper/controla/issues/49)

This ADR is the decision document requested by #47. It consolidates and supersedes the draft strategy in PR #48, which was written before the license change and the CE unlimited change were merged.

## Context

Controla CE was distributed under AGPLv3 with a product-side cap of 3 n8n instances. The commercial backend embeds the CE backend as a Maven library and serves the same frontend. On 2026-11-06 the project owner decided:

1. CE becomes a free, self-hostable edition that is useful in production, without an artificial instance cap.
2. Revenue comes from operating value (managed hosting, advanced diagnostics, incident handling, multi-customer operation), not from limiting CE.
3. CE is relicensed from AGPLv3 to a permissive license; Apache-2.0 was the preferred candidate, MIT the alternative.

## Decision

### License: Apache-2.0, not MIT

| Criterion | Apache-2.0 | MIT | Weight for Controla |
| --- | --- | --- | --- |
| Use, modification, proprietary embedding | Allowed | Allowed | Equal; both allow the Premium backend to embed CE |
| Explicit patent grant and patent-retaliation clause | Yes (§3) | No | Relevant: users and contributors get explicit patent terms |
| Inbound contribution terms | §5: contributions are licensed under Apache-2.0 unless stated otherwise | None | Relevant: removes ambiguity for future outside contributions |
| Attribution | LICENSE + NOTICE must travel with redistributions | Copyright notice only | Slightly higher effort; handled by CI (see below) |
| Trademark | Explicitly not granted (§6) | Silent | Relevant: the name "Controla" stays under owner control |

Apache-2.0 is chosen. MIT is not chosen because it lacks the patent grant, the inbound contribution clause and the explicit trademark exclusion; its lower attribution effort does not outweigh these.

### Scope of the relicensing

- Applies to CE versions published from `main` after commit `e3e7a8c` (PR #51). The first released Apache-2.0 version is **v1.3.0** (`db7713c`); its `LICENSE` and `pom.xml` were checked to carry Apache-2.0.
- **v1.2.2 and earlier stay under AGPLv3.** Recipients of those versions keep their rights; nothing is withdrawn. A rollback of code never revokes a license already granted.
- The license grants no rights to the name or logo "Controla" ([NOTICE](../../NOTICE), [LICENSING.md](../LICENSING.md)).
- The license is separate from product entitlements: feature keys and hosted quotas describe what an installation or contract provides; they are not copyright restrictions on CE code.

### Go/No-Go

| Gate | Result | Evidence |
| --- | --- | --- |
| Owner decision on license and product direction | **Go** (2026-11-06) | #47 |
| Dependency inventory (Maven/npm SBOM, license reports) | Done, advisory | `license-inventory.yml`, PR #50, findings in #49: 95 Maven components without missing license metadata; 2 npm packages (busboy, streamsearch) without metadata, upstream MIT |
| LICENSE/NOTICE in source, plain JAR, Spring Boot JAR and Docker image | Done, enforced by CI | PR #51, `test.yml` |
| Released Apache-2.0 artifact | Done | v1.3.0 |
| Premium depends on an Apache-2.0 CE version, not on the AGPL 1.2.1 artifact | Done | Premium `pom.xml` pins `de.atstck.controla.ce:backend:1.3.0` |
| Rights to historical contributions not authored by the owner; third-party assets; review by a qualified lawyer | **Open** | #49 |

**Overall: Go for the owner's own code, already shipped in v1.3.0.** The open item in #49 does not block CE releases of the owner's code, but it limits what may be claimed: until #49 is closed, do not state that every historical contribution or bundled asset has been cleared for Apache-2.0. If #49 finds a contribution whose author did not grant the needed rights, that code is replaced or removed in a normal PR; the license decision itself stays.

### Risks

| Risk | Mitigation |
| --- | --- |
| A historical outside contribution cannot be relicensed | #49 inventory; replace affected code; future contributions are covered by Apache-2.0 §5 and [CONTRIBUTING.md](../../CONTRIBUTING.md) |
| Third-party notices missing in a shipped artifact | CI checks LICENSE/NOTICE in JAR and image; SBOM workflow; runtime-vs-dev classification is part of #49 |
| Competitors host CE commercially | Accepted by the open-core decision; the trademark is not licensed; paid value lies in operation, not in the code |
| Unlimited CE weakens hosted plans | Hosted plans differentiate by operation and Premium features, see matrix below; no CE paywall |
| Confusion between AGPL and Apache versions | README, LICENSE.md and LICENSING.md name both; release notes for v1.3.0 mark the change |

## CE/Premium feature matrix

Verified against `main` at `1063108` (2026-11-14). "Present" means an endpoint or handler exists in this repository. Premium feature keys are listed only as far as the shared, public frontend references them (`frontend/src/lib/license/features.ts`); their implementation lives in the private Premium backend.

### Present in CE

| Capability | Evidence in code |
| --- | --- |
| Unlimited n8n instances | `CommunityLicenseService.getMaxInstances()` returns `-1`; `InstanceService` skips the cap for `-1` |
| Instance list, details, create, edit | `InstanceController`: `GET/POST /api/instances`, `GET/PUT /api/instances/{id}` |
| Workflow overview | `GET /api/instances/{id}/workflows` |
| Events (incl. workflow errors) | `GET /api/instances/{id}/events` |
| Error patterns of failed executions (the CE "basic metrics") | `GET /api/instances/{id}/error-patterns`; dashboard and instance page |
| Manual workflow export (ZIP) | `GET /api/instances/{id}/export` |
| Diagnostic report: reachability, TLS, health, readiness, API key, failed executions | `diagnostics.report` (tier `COMMUNITY`), `InstanceDiagnosticsController`, `diagnostics/checks/*` |
| Email alerts for instance offline / back online (own SMTP) | `DefaultInstanceAlertHandler.handleInstanceOffline/Online`, `GET/PUT /api/alerts/settings` |
| Users, login, password reset | `auth`, `passwordreset`, `user` packages |
| Feature registry and `/api/license` contract | ADR-002 |

### Premium-only (reported by the Premium backend, absent or disabled in CE)

| Feature key | Capability |
| --- | --- |
| `workflow.import` | Workflow import |
| `backup.scheduled` | Scheduled workflow exports to Google Drive |
| `companion.manage` | Companion (host agent) management |
| `companion.diagnostics.container`, `.logs`, `.stats`, `.events`, `.bundle`, `.snapshots` | Container/log/resource access, Docker events, support bundle, incident snapshots |
| `alert.container_events` | Alerts on OOM, crash loop, unhealthy container |
| `alert.workflow_error`, `alert.invalid_api_key` (behavior keys) | Alerts on workflow errors and invalid API keys; CE handlers log only |
| finite `maxInstances` per tenant | Hosted Solo (10) / Agency (30) quotas, tenant-bound entitlements |

`FeatureRegistryTest.unlimitedCommunityCapacityDoesNotGrantPaidFeatures` pins that CE's unlimited capacity does not enable any of these keys.

### Proposed, not implemented

| Capability | Intended edition |
| --- | --- |
| Time-series metrics (`/metrics`) | CE. Only a stub exists (`CoreApiClient.getInstanceMetrics`); there is no controller endpoint and the frontend does not call `getInstanceMetrics`. The README previously listed the endpoint; corrected with this ADR. |
| Basic backup settings in CE | Open. `BackupSettingsController` echoes `PUT` without persisting; the UI only requests it when `backup.scheduled` is present. Decide whether CE gets a real basic backup or the endpoint is removed. |
| Incident management, uptime history | Premium |
| Multi-customer / agency operation, automation | Premium |
| Managed hosting with operational responsibility | Commercial service |
| Self-hosted Premium license | Not offered; requires its own decision (private Premium #25) |

## PR split, tests and rollback

| Step | Content | State |
| --- | --- | --- |
| 1 | License inventory workflow and SBOM (#50) | Merged |
| 2 | Apache-2.0 LICENSE, NOTICE, CONTRIBUTING, POM/npm metadata, JAR/Docker notice checks (#51) | Merged |
| 3 | CE without instance cap, feature entitlements (#38/#39) | Merged |
| 4 | Release v1.3.0 and Premium pin to 1.3.0 | Done |
| 5 | This ADR and README correction | This PR |
| 6 | Rights review of historical contributions and assets | #49 |
| 7 | CE metrics endpoint or removal of the claim; CE backup endpoint decision | New issues, see above |

**Tests that guard the boundary:** `LicenseConfigurationTest` (CE `-1`, Premium can replace the license bean), `FeatureRegistryTest` (no paid key enabled in CE), `FeatureContractTest` (every key has an endpoint), `FeatureGuardInterceptorTest` (404 for disabled keys), frontend `entitlements.test.ts` (missing key = disabled, legacy fallback), CI LICENSE/NOTICE checks in `test.yml`.

**Rollback:** Code changes are rolled back by redeploying an earlier version. Rolling back to v1.2.2 restores the 3-instance cap without deleting instances (see [CE_LIMIT_RECOMMENDATION.md](../CE_LIMIT_RECOMMENDATION.md)). The license change is not reversible for versions already published under Apache-2.0; a later license change would only apply to new versions.

## Alternatives Considered

- **Stay on AGPLv3:** keeps copyleft protection, but deters adoption by companies and complicates embedding CE in the proprietary backend.
- **MIT:** see comparison above.
- **Source-available license (BSL, Elastic, SSPL):** not open source; contradicts the goal of a free, production-ready CE.
- **Keep an instance cap in CE:** rejected on 2026-11-06 in favor of differentiation through operation and Premium features.

## Related

- [ADR-002: Feature registry](ADR-002-feature-registry.md)
- [LICENSING.md](../LICENSING.md), [LICENSE_INVENTORY.md](../LICENSE_INVENTORY.md), [CE_LIMIT_RECOMMENDATION.md](../CE_LIMIT_RECOMMENDATION.md)
