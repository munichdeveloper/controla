---
description: "Check documentation consistency for a PR."
---

Review the selected code changes and the current documentation.

Output:
- Missing doc updates (list file paths and why)
- Terminology drift (terms not in glossary)
- ADR needed? (yes/no + reason)
- Duplications to remove by replacing with references

Rules:
- Do not rewrite docs. Only report issues and propose minimal patch snippets.