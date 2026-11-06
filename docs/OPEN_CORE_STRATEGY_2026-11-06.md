# Controla Open Core – rollout plan (proposal, 2026-11-06)

**Status:** Proposed strategy and licensing-readiness work. **No change to the effective license, pricing, customer rights, deployments, or current releases by this document.** Tracking: [#47](https://github.com/munichdeveloper/controla/issues/47).

## 1. Product principles

- **Community Edition (CE):** Open source, free, self-hosted, useful in production, no product-enforced n8n instance cap. Operators remain responsible for infrastructure, upgrades and support.
- **Commercial offering:** Customers pay for professional operating outcomes (managed hosting, advanced operations, customer/tenant management and support), *not merely for hiding the source or removing an arbitrary CE restriction*.
- **Shared frontend / feature contract:** Backends advertise implemented, authorized capabilities through `GET /api/license`. A UI feature is not a license enforcement boundary; server-side checks remain authoritative.
- **Two independent pricing dimensions:** Who operates the software (self-hosted vs. managed) and which service capabilities the customer needs. A managed-hosting capacity quota is not automatically the right model for an optional self-hosted premium license.
- **No retroactive change to existing contracts.** Preserve legacy entitlements until inventoried and explicitly migrated.

## 2. Verified state vs. proposed capability split

Information is from current repo documentation and the open PRs listed below; "future" cells are product proposals, not shipped promises.

| Capability | CE target | Hosted / commercial target | Implementation state |
| --- | --- | --- | --- |
| Self-hosted, basic operations | Free | Optional managed operation | CE ships self-hosted deployment |
| Connected n8n instances | No product-side cap | Hosted quotas may apply | CE unlimited implemented on pending #38; main still returns 3 |
| Status / workflow / execution overview | Included | Included | CE documented in README |
| Basic metrics, email alerting, diagnostics | Included | Included | CE documented in README |
| Manual workflow-definition export | Included | Included | Documented in open tariff PRs |
| Workflow import | Not an automatic CE entitlement | Agency feature in current hosted pilot | Staged in open premium/website PRs |
| Scheduled Google Drive exports | Not an automatic CE entitlement | Agency feature in current hosted pilot | Staged in open premium/website PRs |
| Advanced operations diagnostics | Not part of basic CE promise | Candidate commercial operating value | Scope and availability require separate verification |
| Incident management and uptime history | Not part of basic CE promise | Candidate paid operational value | Subject to separate product decision |
| Multi-customer operations and automation | Not promised in CE | Candidate commercial differentiator | Subject to roadmap and implementation |
| Managed hosting and operational accountability | Not included | Core commercial value | Contract and delivery model must be established |

**Existing hosted pilot proposals:** Solo EUR 29/month up to 10 instances, Agency EUR 79/month up to 30 instances. These are **hosted pilot conditions**, not a precedent for limiting CE. No Agency Max until further validation. Any proposed extension to self-hosted paid functionality needs a separate decision.

### Commercial positioning risk

Unlimited self-hosted CE changes the proposition for hosted plans. Users must be buying concrete operating services or capabilities. The actual contents and internal implementation status of proprietary offerings are documented and decided in the private commercial repository; this public proposal makes no claim that unshipped features are available.

## 3. License decision and explicit gate

**Current:** AGPLv3, see `LICENSE.md`. **Candidate:** Apache License 2.0; MIT is a permissive alternative. This document **does not authorize or implement relicensing**.

### Legal and provenance gate (must be completed before LICENSE changes)

1. Inventory authorship and rights for all included source, assets, snippets and documentation, including historical outside contributions; retain proof of permission to relicense each relevant contribution. `CONTRIBUTING.md` says contributors grant commercial relicensing rights, but binding acceptance and scope for a *public Apache-2.0 relicensing* require legal review. Authorship in GitHub alone is insufficient proof.
2. Audit Maven/npm transitive dependencies, frontend assets, images, vendored content and container/base images for redistribution obligations. Generate a machine-readable dependency inventory/SBOM and review third-party notices for source and binaries.
3. Review published AGPL versions and corresponding-source obligations for existing distributions; relabeling the latest branch does not revoke recipients' rights to historical releases.
4. Ensure proprietary distributions use code with valid commercial/relicensing permissions; check the premium backend's direct Java dependency on CE and the exact content of the shipped JAR/container.
5. Draft Apache-2.0 `LICENSE`, copyright/SPDX headers where suitable, and applicable `NOTICE` and third-party notices **only after the legal rights decision**. Track source and binary artifacts separately. Apache-2.0 does not grant trademark rights.
6. Review commercial EULA/support terms for any self-hosted commercial distribution and hosted service terms. Distinguish license rights, support promises, and feature/service entitlements.
7. Have a qualified legal reviewer confirm Go/No-Go, and record the decision in a separate ADR before any public relicensing release.

References (primary texts): [Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0), [Apache application guidance](https://www.apache.org/legal/apply-license.html), [AGPLv3](https://www.gnu.org/licenses/agpl-3.0.en.html).

## 4. Implementation sequence and review gates

| Phase | Work | Delivery gate |
| --- | --- | --- |
| A – complete ongoing feature work | Review CE [#38](https://github.com/munichdeveloper/controla/pull/38), premium pricing/entitlements and website separately | Tests/CI, production compatibility and existing contract review |
| B – provenance and product decision | Rights inventory, dependency notices/SBOM, accurate CE/paid capability matrix, hosted vs self-hosted product boundaries | Written legal Go/No-Go and explicit license/product decision |
| C – relicensing changes | Separate **review PR** for `LICENSE`, `CONTRIBUTING`, copyright/SPDX, notices, packaging, README/AGENTS and compliance workflow | All original copyright permissions and third-party obligations reviewed; no unreviewed license flip |
| D – release | Once approved, coordinate CE + Premium dependency artifact + website claims, with versioned licenses and release notes | User-approved merge/release; verify that historical AGPL packages remain correctly marked |

### Compatibility and rollback

- `GET /api/license` contract (edition, `maxInstances`, `features`) remains stable; `-1` is the existing unlimited sentinel. Do not infer a paid capability from unlimited capacity.
- Feature keys are enforced on the backend as well as hidden in the shared frontend. Older clients and changing entitlements need compatibility testing; stale authorizations must fail closed.
- Commercial integrations may depend on versioned CE artifacts; downstream compatibility must be verified against a released version, not assumed from unreleased branches.
- Feature rollout can be reverted by deployment/version rollbacks under the normal process. **Previously distributed open-source rights cannot be revoked by a rollback**.
- No automatic merges, deployments, plan/billing migration or customer notification without explicit approval.

## 5. Release acceptance criteria

- [ ] Rights to relicense and third-party provenance reviewed, findings recorded, legal Go/No-Go received.
- [ ] Versioned license/NOTICE/SPDX/SBOM and binary redistribution process validated.
- [ ] Actual capabilities and plan entitlements match public pricing and the `/api/license` contract.
- [ ] CE unlimited and legacy/finite Premium limits independently tested; feature segregation verified.
- [ ] Commercial agreements and tenant mappings reviewed through the nonpublic launch process.
- [ ] Self-hosted Premium is either separately specified or explicitly excluded from the offer.
- [ ] All PRs reviewed and release approved; no unannounced licensing transition.
