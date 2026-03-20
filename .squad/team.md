# Squad Team

> Controla is an ops layer for the productive operation of n8n for agencies.

## Coordinator

| Name | Role | Notes |
|------|------|-------|
| Squad | Coordinator | Routes work, enforces handoffs, reviewer gates, and team rituals. |

## Members

| Name | Role | Charter | Status |
|------|------|---------|--------|
| Ripley | Lead / Reviewer | `.squad/agents/ripley/charter.md` | ✅ Active |
| Parker | Backend Core | `.squad/agents/parker/charter.md` | ✅ Active |
| Lambert | Frontend Product | `.squad/agents/lambert/charter.md` | ✅ Active |
| Hicks | Security & Tenancy | `.squad/agents/hicks/charter.md` | ✅ Active |
| Bishop | Integrations & Platform | `.squad/agents/bishop/charter.md` | ✅ Active |
| Vasquez | QA / Contracts / Release Confidence | `.squad/agents/vasquez/charter.md` | ✅ Active |
| Scribe | Session Logger | `.squad/agents/scribe/charter.md` | 📋 Silent |
| Ralph | Work Monitor | — | 🔄 Monitor |

## Coding Agent

<!-- copilot-auto-assign: false -->

| Name | Role | Charter | Status |
|------|------|---------|--------|
| @copilot | Coding Agent | — | 🤖 Coding Agent |

### Capabilities

**🟢 Good fit — bounded tasks following existing patterns:**
- Small Spring Boot fixes in controllers, services, DTOs, or repositories
- Small Next.js fixes in existing pages, components, or query hooks
- Test additions, regression coverage, and flaky test cleanup
- Docs, README, and deployment documentation updates
- Dependency bumps and mechanical refactors
- Straightforward CRUD wiring with clear acceptance criteria

**🟡 Needs review — allow, but require a named squad reviewer:**
- New backend endpoints following an established pattern
- Schema or Flyway-adjacent changes with explicit requirements
- TanStack Query data-flow changes
- Docker, Compose, or environment wiring changes
- Small Agency Core or n8n integration adapters with a fixed contract

**🔴 Not suitable — route to a squad member instead:**
- JWT, Spring Security, password reset, crypto, or secret handling
- Tenant isolation, authorization boundaries, or `TenantContext` changes
- Licensing and entitlement rules
- Cross-layer architecture decisions
- Unbounded integration work or incident handling
- Work that changes contracts without clear specs

## Project Context

- **Owner:** j
- **Stack:** Java 17, Spring Boot 3.2.x, Next.js 14, TypeScript, PostgreSQL 16, Docker Compose, JWT, Agency Core API, n8n integrations
- **Description:** Multi-tenant ops layer for agencies that monitor and operate n8n in production.
- **Created:** 2026-03-19
