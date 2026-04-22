# Squad Decisions

## Active Decisions

- The Controla squad is organized around product seams: lead/review, backend core, frontend product, security/tenancy, integrations/platform, and QA/release confidence.
- Auth, crypto, tenancy, and secret-handling work route through Hicks with Ripley review.
- Agency Core API, n8n integration, Docker, and environment/runtime wiring route through Bishop.
- Follow repository Copilot guidance from `.github/copilot-instructions.md`, including docs placement under `/docs/**` (or `/doc-meta/**`) and required docs updates for behavior/API/ops changes with ADR policy constraints.
- For backend OpenTelemetry work: use code-based Spring Boot integration with full external configuration via environment variables, secure defaults without sensitive data, and instrumentation for incoming HTTP requests, outgoing `RestTemplate` propagation, and `InstanceStatusChecker` scheduled job.

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction
