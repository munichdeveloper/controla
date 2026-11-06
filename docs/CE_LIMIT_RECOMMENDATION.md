# CE instance capacity: confirmed unlimited self-hosting

Decision date: 6 November 2026. Implementation: #39 / PR #38. The user explicitly approved removing the CE product-side cap after discussing differentiation through features and hosted operations. This supersedes the earlier recommendation to retain 3 and the 3-versus-5 evaluation in #37. It is review code, not a published release.

## Verified state

Released CE v1.2.2 (`344b0dc`) returns **3**. This branch changes the default to **-1**, the already-supported Unlimited sentinel. `InstanceService.createInstance` and the shared frontend already interpret it as no product-side instance cap. Unlimited creation skips the capacity lock/count; tenant ownership, authentication, credential encryption and persistence stay unchanged.

Finite extension licenses still use the existing tenant-scoped PostgreSQL admission lock/count and HTTP 403 at the cap. Solo remains EUR 29/month for 10, Agency EUR 79/month for 30. The CE default bean is conditional, so a Premium license still replaces it; the Premium repository remains pinned to published CE 1.2.1 and does not inherit this default change. Production and staging each count separately in finite plans.

## Product rationale and feature boundaries

Self-hosters provide infrastructure, installation, operation and updates. Removing the arbitrary CE cap supports useful adoption across a complete fleet. Paid offers differentiate through hosted operations and their confirmed features: Solo adds hosted basic alarms; Agency adds workflow import and scheduled Google Drive exports. No new Enterprise tier or Agency Max is implemented.

CE retains its existing overview, metrics, own-SMTP offline/recovery alerts, manual workflow export and core diagnostic report. Unlimited capacity does not grant workflow-error/API-key alerts, import, scheduled exports or paid Companion/Enterprise features. Missing feature keys still deny access. No entitlement bypass based on `maxInstances == -1` is added.

This is a strategic choice, not a measured claim about conversion or infrastructure capacity. Real self-hosted fleet sizes, retention and support costs are unknown without voluntary user evidence. No telemetry is added. Practical capacity depends on workload and operator resources; unlimited is not a throughput, uptime or support guarantee. Future capacity/performance work should use representative loads and voluntary feedback rather than inventing adoption data.

## Migration, existing customers and rollback

No SQL migration, schema change, data rewrite, dependency bump or public SPI/DTO change is required. Existing instances and credentials are retained. Upgrading CE permits additional creates immediately. Rolling back to CE v1.2.2 restores the 3-instance admission rule: fleets already above 3 stay readable, monitored, editable and exportable, but cannot create more until below that cap or upgraded again. Never delete rows to reconcile capacity.

Paid tenant limits and legacy Unlimited/Special contracts remain separate from the CE decision. No automatic plan or contract remapping occurs. Existing Premium launch gates (explicit provisioning, contract inventory, strict fallback configuration and real Hosted/Drive/restore acceptance) remain mandatory before selling the new plans.

## Shared frontend compatibility

The stable `edition`, `maxInstances`, `features` contract is retained. After verified login, the frontend refreshes the license with authentication; login bootstrap stays anonymous, including when an expired token is stored. Account changes invalidate the previous entitlement snapshot. The legacy premium edition names remain recognized.

New gates use `workflow.import`, `backup.scheduled`, `companion.manage`. Explicit false wins. Only when **all three** keys are absent on a known old premium edition does the UI preserve the three previously guaranteed endpoints. Other missing and unknown keys remain false. This narrow version compatibility is a display rule; the backend authorizes every operation. Older premium backends keep their existing behavior until upgraded.

Existing report/alert feature keys are retained. Import, backup settings/status requests, companion controls and polling now follow their own server flags. CE manual export and the core diagnostic report remain available. Rebase this branch with the independent framework PR #36 before merging both; no framework changes are duplicated here.

## Verification

Java 17/Maven: 91 tests passed, including 8 PostgreSQL Testcontainers cases. Real CE defaults and API response report -1; real CE HTTP creation succeeds beyond 3/30/120 existing instances, and two database-backed application contexts persist 31 instances. Tests also verify no paid feature unlock, conditional Premium overrides at 10/30/-1, finite extension boundaries/concurrency, empty tenants, rollback and tenant separation. Historical mocked 3-instance extension cases are deliberately retained as compatibility cases, not CE product expectations. Frontend and exact commands are recorded in `docs/TARIFF_VERIFICATION.md`.
