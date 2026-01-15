---
description: "Update existing documentation after a code change (no random docs)."
---

You are updating documentation based on recent code changes.

## Rules (must follow)
- Do not create docs outside /docs/** and /doc-meta/**.
- Prefer updating existing docs; only add a new doc if no appropriate one exists.
- Avoid duplication; reference existing docs instead.
- Keep glossary consistent with /doc-meta/glossary.yaml.
- If the change is an architecture decision, propose a NEW ADR under /docs/04_decisions/.

## Task
1) Identify which existing docs are impacted by the changes in the selected code and diff.
2) Propose minimal updates in-place:
    - file path
    - section heading
    - new content only
3) If new terms appear, propose additions to /doc-meta/glossary.yaml.
4) If an ADR is needed, propose ADR title + outline (Status: Proposed).

## Context to consider
- system: #file:../../doc-meta/system.yaml
- glossary: #file:../../doc-meta/glossary.yaml
- ADRs: #file:../../docs/04_decisions/README.md  (if present)