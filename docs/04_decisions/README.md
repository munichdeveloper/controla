# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records for Controla.

## Index

- [ADR-001: Single Container Deployment für Backend und Frontend](ADR-001-single-container-deployment.md) - **Accepted** (2026-01-16)
- [ADR-002: Feature registry as contract between frontend and backend](ADR-002-feature-registry.md) - **Accepted** (2026-10-14)

## ADR Format

Each ADR follows this structure:

```markdown
# ADR-XXX: Title

**Status:** Proposed | Accepted | Deprecated | Superseded by ADR-YYY
**Datum:** YYYY-MM-DD
**Entscheider:** Team/Person

## Context
Problem statement and background

## Decision
What was decided and how it works

## Consequences
### Positive
### Negative
### Neutral

## Alternatives Considered
Other options that were rejected

## Implementation Notes
Technical details for implementation

## Related
Links to related ADRs or documentation
```

## Policy

- Existing ADRs are **immutable** except for adding an "Errata" section
- New decisions require a new ADR file
- Status changes are allowed (e.g., Accepted → Deprecated)

