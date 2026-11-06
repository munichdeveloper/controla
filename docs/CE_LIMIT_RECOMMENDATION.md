# CE instance limit: evidence and recommendation

Decision date: 6 November 2026. Related issue: #37. No limit increase is implemented.

## Verified state

`CommunityLicenseService.getMaxInstances()` returns **3**, also in released CE v1.2.2. The value is a tenant capacity limit, not a global installation total. `InstanceService.createInstance` locks admission in PostgreSQL before counting the current tenant's persisted instances. It rejects a new instance at or above the limit with HTTP 403. The lock also works for an empty tenant and across independent application contexts. Unlimited extension licenses (`-1`) remain supported.

Production and staging each count as a connected instance. Existing rows over the limit are not deleted or disabled. The admission check only affects creation: monitoring, reading, updating, manual workflow export and deletion remain available. No SQL migration, dependency update or CE SPI change is introduced here.

## Recommendation

Keep **3** for the next release. It permits a small evaluation fleet or production/staging/development without introducing an unapproved change. Paid hosted editions differentiate through hosting and features, so CE capacity should not be the only upgrade argument.

Increasing to 5 would help an evaluator with more environments, but no activation, retention, conversion, infrastructure-cost or support-cost evidence currently establishes that 5 is better. These are hypotheses, not measured benefits or revenue losses. Reducing the cap would risk existing installations and is not recommended.

Before reconsidering 3 versus 5, collect a bounded, voluntary evaluation cohort: successful installations and first useful result; distribution of 1/2/3 connected instances; users blocked at the fourth instance and their actual use cases; repeat usage; hosted interest and support time. Self-hosted instance counts are **unknown** unless users explicitly provide them. Do not add remote telemetry or fingerprinting as part of this change. Agree a data window and decision criteria before collecting data; small samples should remain qualitative.

An eventual increase needs explicit product approval, one source-of-truth change, matching UI/website documentation and repeat admission/concurrency tests. Existing over-limit rows must retain access; do not use data deletion to reconcile a new cap.

## Shared frontend compatibility

The stable `edition`, `maxInstances`, `features` contract is retained. After verified login, the frontend refreshes the license with authentication; login bootstrap stays anonymous, including when an expired token is stored. Account changes invalidate the previous entitlement snapshot. The legacy premium edition names remain recognized.

New gates use `workflow.import`, `backup.scheduled`, `companion.manage`. Explicit false wins. Only when **all three** keys are absent on a known old premium edition does the UI preserve the three previously guaranteed endpoints. Other missing and unknown keys remain false. This narrow version compatibility is a display rule; the backend authorizes every operation. Older premium backends keep their existing behavior until upgraded.

Existing report/alert feature keys are retained. Import, backup settings/status requests, companion controls and polling now follow their own server flags. CE manual export and the core diagnostic report remain available. Rebase this branch with the independent framework PR #36 before merging both; no framework changes are duplicated here.

## Verification

Java 17/Maven: 77 non-container backend tests and 7 PostgreSQL Testcontainers cases passed (84 total), including 3, generic 10/30 extension limits, empty-tenant admission, parallel workers, rollback, tenant separation and Unlimited compatibility. Frontend verification and exact commands are recorded in `docs/TARIFF_VERIFICATION.md`.
