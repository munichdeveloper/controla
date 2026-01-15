---
description: "Add regression-focused tests that fail on subtle refactor breakage."
---

You are writing tests specifically designed to catch regressions.

## Rules (must follow)
- Prefer black-box assertions.
- Include boundary conditions and tricky inputs.
- Keep tests stable across refactors.

## Task
- Identify 3–7 regression-prone behaviors.
- For each, implement a test that would fail if logic changes subtly.
- Explain what refactor mistake it protects against.

## Context to consider
- recent bug reports or diffs: as provided
- existing test utilities: #file:../**/TestUtils* (if present)