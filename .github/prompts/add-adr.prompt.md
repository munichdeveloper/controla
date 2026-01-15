---
description: "Create a new ADR for an architecture decision (no rewriting old ADRs)."
---

Determine whether the described change requires a new ADR.
If yes:
- Create a NEW ADR under /docs/04_decisions/ as ADR-XXX-<slug>.md
- Include: Status (Proposed), Context, Decision, Consequences, Alternatives considered
  If no:
- Explain why and suggest the correct doc file + section to update instead.

Rules:
- Do not modify existing ADR decisions (except adding Errata).
- Do not create docs outside /docs/** and /doc-meta/**.