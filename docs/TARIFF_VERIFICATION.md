# Tariff frontend / CE verification

6 November 2026. No merge, package publication, SQL migration or production change. Main baseline: `344b0dc`. Framework PR #36 remains independent.

The first branch push unexpectedly triggered the pre-existing Vercel frontend integration and created preview `dpl_G7mKj2RFadoHZahfBqvX5HX85ZSy`. This was outside the no-deployment request. Its removal is awaiting the action-time confirmation required by the browser deletion policy. Branch-specific `git.deploymentEnabled:false` rules at the repository and frontend roots prevent further automatic previews on this review branch; the next push was verified not to create one. Other branches and production settings are unchanged. A new preview requires explicit authorization and removing the branch rule.

| Check | Result |
|---|---|
| Java 17 backend `mvn -B -pl backend verify` | 84 tests, zero failures/errors/skips, PostgreSQL Testcontainers included |
| Node 24.22.0 `npm test` | 21 tests passed |
| `npm run typecheck` | passed |
| `npm run lint` | passed, no warnings/errors |
| `npm run build` | Next 14 production build passed; no Next/React dependency changes |
| Optional Chromium contract script | Solo, Agency, old Premium: 3 complete flows passed |

The PostgreSQL cases use independent Spring application contexts sharing a database: empty-tenant admission, parallel creators, rollback, tenant separation and Unlimited. Added numeric extension cases test the last allowed and first rejected instance at 10/30 and a downgrade already over its new cap. `CommunityLicenseService` remains 3; no product limit was increased.

The browser script starts the built local Next server, intercepts all `/api/**` calls and uses invalid-domain fixture identities. It verifies anonymous bootstrap -> login -> authenticated license refresh -> displayed limit -> workflow import/companion visibility -> backup-settings request gating. Solo and Agency make no excluded companion requests; Solo makes no Drive-settings request. The old backend fixture omits the new keys and preserves its existing UI. This is a contract fixture, not real Premium/Kitly/Drive execution. Real Premium server authorization is tested in the private backend suite against its pinned CE artifact.

To reproduce, from `frontend/` with Node 24:

```text
npm ci
npm test
npm run typecheck
npm run lint
npm run build
# Pass a separately installed Playwright module; no dependency duplication with PR #36.
node scripts/verify-tariffs.mjs /absolute/path/to/playwright/index.mjs
```

The local run used the existing marketing checkout's Playwright 1.65.0 and its installed Chromium. The script closes its browser and local server. Its three printed PASS lines are the result, with assertions failing the process otherwise. Browser tests in framework PR #36 should be rerun after rebasing both changes; this branch does not duplicate its dependency migration or CI infrastructure.

Existing CE/Premium extension signatures and the `edition` string are preserved. Anonymous modern hosted capabilities are tagged `tenantBound:false`; the new UI waits for authenticated entitlements. Stale user responses are aborted/discarded, and the prior user's entitlement snapshot is invalidated immediately on account changes. Explicit false always wins; only the three guaranteed old Premium endpoints have a scoped compatibility fallback.
