# Periodic quality review

The `Periodic Quality Review` GitHub Actions workflow runs every Monday at 03:17 UTC and can also be started manually with `workflow_dispatch`.

## Checks and results

The workflow uses Java 17, Node.js 20, Maven, and `npm ci`, matching the repository build conventions. It runs the backend build and tests with JaCoCo coverage, the existing non-blocking backend Checkstyle check, the frontend production build, ESLint, a TypeScript no-emit check, and npm audit/outdated inspection. A dependency-free repository scan also counts TODO/FIXME markers and source files over 400 lines.

Each run writes `quality-report.json` and `quality-report.md`, adds the Markdown report to the GitHub Actions job summary, and uploads the reports plus available JaCoCo, Surefire, Checkstyle, and npm diagnostic files as a 90-day artifact.

The backend build/tests, frontend build, frontend lint, and frontend type check fail the workflow. Backend Checkstyle remains informational because the existing CI treats it as non-blocking. Coverage, large files, TODO/FIXME markers, dependency findings, and measured regressions are also informational in this first baseline-oriented version. Frontend tests, duplication, complexity, and backend vulnerability scanning are reported as unavailable rather than assigned invented values.

## Baselines and extension

The latest report from a run that passed all required checks is saved in the GitHub Actions cache. A later run restores the newest report for the same branch and identifies passing checks that became failures, coverage drops, TODO/FIXME growth, new oversized files, and increases in frontend vulnerability findings. Failed runs do not replace the last healthy baseline. If the cache is absent or expired, the run clearly records that it is establishing a new baseline. Artifacts remain the authoritative per-run evidence; the cache is only a best-effort comparison mechanism.

Add future metrics in `.github/scripts/generate-quality-report.mjs`, including an explicit `available` indicator, and add their collection step to `.github/workflows/periodic-quality-review.yml`. Only promote a metric to `failurePolicy.requiredChecks` after the repository has an agreed, stable regression policy. The report's `aiReview` section lists architecture documents, repository conventions, and candidate files so a future coding-agent step can consume focused context without scanning the full repository or judging undocumented style preferences.
