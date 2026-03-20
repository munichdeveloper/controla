# Work Routing

How to decide who handles what.

## Routing Table

| Work Type | Route To | Examples |
|-----------|----------|----------|
| Architecture, scope, cross-layer changes, issue triage | Ripley | ADRs, feature slicing, breaking changes, review arbitration |
| Spring Boot API, services, repositories, DTOs | Parker | Instances, alerts, backup settings, domain validation, persistence |
| Next.js pages, components, forms, query hooks | Lambert | Dashboards, settings flows, tables, operator UX |
| JWT, Spring Security, password reset, tenancy boundaries | Hicks | Auth flows, token handling, `TenantContext`, crypto, secret handling |
| Agency Core API, n8n clients, runtime and deployment plumbing | Bishop | API adapters, polling, retries, Docker, Compose, env wiring |
| Tests, release checks, regression confidence | Vasquez | Backend tests, UI regression checks, contract drift, tenant isolation scenarios |
| Code review | Ripley | Review risky PRs, enforce handoffs, ask for specialist review |
| Testing | Vasquez | Write tests, define edge cases, verify fixes before release |
| Scope & priorities | Ripley | What to build next, trade-offs, sequencing, escalation |
| Async issue work (bugs, tests, small features) | @copilot 🤖 | Well-defined tasks that match the capability profile in `team.md` |
| Session logging | Scribe | Automatic — never needs routing |
| Backlog monitoring | Ralph | Keep an eye on open squad work and idle capacity |

## Issue Routing

| Label | Action | Who |
|-------|--------|-----|
| `squad` | Triage: analyze issue, evaluate @copilot fit, assign `squad:{member}` label | Ripley |
| `squad:{name}` | Pick up issue and complete the work | Named member |
| `squad:copilot` | Assign to @copilot for autonomous work (if enabled) | @copilot 🤖 |

### How Issue Assignment Works

1. When a GitHub issue gets the `squad` label, **Ripley** triages it — analyzing content, evaluating @copilot's capability profile, assigning the right `squad:{member}` label, and commenting with triage notes.
2. **@copilot evaluation:** Ripley checks if the issue matches @copilot's capability profile (🟢 good fit / 🟡 needs review / 🔴 not suitable). If it's a good fit, Ripley may route to `squad:copilot` instead of a squad member.
3. When a `squad:{member}` label is applied, that member picks up the issue in their next session.
4. When `squad:copilot` is applied and auto-assign is enabled, `@copilot` is assigned on the issue and picks it up autonomously.
5. Members can reassign by removing their label and adding another member's label.
6. The `squad` label is the "inbox" — untriaged issues waiting for Lead review.

### Lead Triage Guidance for @copilot

When triaging, Ripley should ask:

1. **Is this well-defined?** Clear title, reproduction steps or acceptance criteria, bounded scope → likely 🟢
2. **Does it follow existing patterns?** Adding a test, fixing a known bug, updating a dependency → likely 🟢
3. **Does it need design judgment?** Architecture, API design, operator UX changes, or scope trade-offs → likely 🔴
4. **Is it security-sensitive?** Auth, encryption, access control, tenancy, or secrets → always 🔴
5. **Does it touch external contracts?** Agency Core, n8n integration semantics, or deployment/runtime assumptions → usually 🟡 or 🔴
6. **Is it medium complexity with specs?** Feature with clear requirements, refactoring with tests → likely 🟡

## Rules

1. **Eager by default** — spawn all agents who could usefully start work, including anticipatory downstream work.
2. **Scribe always runs** after substantial work, always as `mode: "background"`. Never blocks.
3. **Quick facts → coordinator answers directly.** Don't spawn an agent for "what port does the server run on?"
4. **When two agents could handle it**, pick the one whose domain is the primary concern.
5. **"Team, ..." → fan-out.** Spawn all relevant agents in parallel as `mode: "background"`.
6. **Anticipate downstream work.** If a feature is being built, spawn the tester to write test cases from requirements simultaneously.
7. **Issue-labeled work** — when a `squad:{member}` label is applied to an issue, route to that member. The Lead handles all `squad` (base label) triage.
8. **@copilot routing** — when evaluating issues, check @copilot's capability profile in `team.md`. Route 🟢 good-fit tasks to `squad:copilot`. Flag 🟡 needs-review tasks for PR review. Keep 🔴 not-suitable tasks with squad members.
9. **Security and tenancy work** — Hicks owns implementation; Ripley reviews; Vasquez verifies.
10. **Integration and runtime work** — Bishop owns the contract and platform edge; Parker supports when domain changes are needed.
11. **Cross-layer features** — Ripley slices the work first, then routes backend, frontend, and QA in parallel.
