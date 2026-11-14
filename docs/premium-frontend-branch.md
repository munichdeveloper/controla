# Premium frontend promotion

Tracking: [#84](https://github.com/munichdeveloper/controla/issues/84).

The Premium frontend source is `frontend/` on **`premium/frontend`** in
`munichdeveloper/controla`. Community development continues on `main`. After
initialization, changes reach `premium/frontend` only through individually
selected cherry-picks in reviewed promotion PRs. Never merge `main` into this
branch, reset it to `main`, or configure an automatic branch sync.

This runbook defines the setup; adding it does **not** create the branch, enable
GitHub protection, or switch the private Premium build. The maintainer checklist
below must be completed before this process is active.

## Initialize and protect the branch (maintainer)

1. Identify the full Controla commit SHA that supplied the frontend currently
   approved for Premium, using the Premium build/deployment record. Verify that
   its `frontend/` matches the deployed source. If the source is unknown or has
   local modifications, reconcile and approve a baseline first; do not silently
   select today's `main`.
2. Create `premium/frontend` at that approved commit in this repository. Record
   the baseline SHA and approval in #84. This one-time baseline is the starting
   point for selective promotion, not approval of later `main` changes.
3. Configure a GitHub branch ruleset or branch protection rule for the exact
   branch name `premium/frontend`:

   | Setting | Required value |
   | --- | --- |
   | Updates | Pull requests only; no direct pushes |
   | Reviews | At least one approving maintainer other than the author; dismiss stale approvals and require approval of the most recent reviewable push |
   | Conversations | Resolve all review conversations before merging |
   | Status checks | Require `test-backend`, `test-frontend`, and `test-docker` from GitHub Actions (workflow **Test**) |
   | Freshness | Require the PR branch to be up to date with `premium/frontend` |
   | History | Require linear history; use **Rebase and merge** for promotion PRs to preserve each cherry-pick's message and provenance |
   | Destructive updates | Disallow force pushes and branch deletion |
   | Bypass | Enforce for administrators as well; no actor/app bypass of the PR, review, or check gates |

   Enable **Rebase and merge** in repository settings if unavailable. Select the
   actual job checks from a recent PR run, not just the workflow name `Test`.
   Verify that the baseline contains the expected CI before enabling Premium
   consumption. If it predates those jobs, a maintainer must prepare the needed
   CI update through a reviewed PR before switching the build.
4. Create PR labels `premium:promotion` and `premium:promoted` as described below.

The current [Test workflow](../.github/workflows/test.yml) runs on pushes to all
branches and PRs targeting all branches, so `premium/frontend` needs no new
trigger. Its frontend job includes lint, unit tests, production build, typecheck,
and browser tests; the other jobs validate the backend and Docker/Hostinger stack.
These checks exercise this repository, not the private Premium backend.

Branch protection does not prove that a PR contains only approved cherry-picks.
The maintainer review must check provenance, dependencies and the complete diff;
green CI alone does not authorize a bulk import from `main`.

## Promote selected changes

Use a clean checkout with `origin` pointing to `munichdeveloper/controla`.
Replace `REPLACE_WITH_FULL_SOURCE_SHA` below with a reviewed full commit SHA.

1. Identify the required commits on `main`, including their explicit dependencies.
   Prefer frontend-only, single-purpose commits. Review changes to the lockfile,
   Node/npm versions, build configuration and feature keys together with the UI.
   A mixed frontend/backend commit must first be split into independently
   reviewable commits on `main`; do not import an unrelated backend change or
   silently cherry-pick only some paths. For a merge commit, select its underlying
   non-merge commits instead of using `cherry-pick -m` to import an entire PR.

2. Fetch both branches and create a short-lived branch **from Premium**:

   ```sh
   git status --short  # must be empty, including untracked files
   git fetch origin main:refs/remotes/origin/main premium/frontend:refs/remotes/origin/premium/frontend
   git switch --create promote/premium-login-fix origin/premium/frontend
   SOURCE_SHA=REPLACE_WITH_FULL_SOURCE_SHA
   git merge-base --is-ancestor "$SOURCE_SHA" origin/main
   git show --stat "$SOURCE_SHA"
   git show "$SOURCE_SHA"
   ```

   Stop if the source is not a commit on `main`. The promotion branch name is an
   example; choose a unique topic. Review the source PR and its dependencies even
   when the commit has already passed Community CI.

3. Cherry-pick only the selected commit, keeping its source SHA in the message:

   ```sh
   git cherry-pick -x "$SOURCE_SHA"
   ```

   Repeat for additional explicitly approved SHAs, oldest dependency first; do
   not pass a broad commit range. `-x` adds `(cherry picked from commit <sha>)`.
   For conflicts, resolve only what the selected change needs, stage the resolved
   files with `git add <path>`, and run `git cherry-pick --continue`. Describe the
   resolution in the PR and preserve the source trailer (restore it if needed).
   Use `git cherry-pick --abort` to abandon the in-progress pick. Investigate an
   empty/duplicate pick before using `--skip`; record an existing equivalent
   promotion rather than forcing an empty commit.

4. Inspect the complete result against Premium:

   ```sh
   git log --format=full origin/premium/frontend..HEAD
   git rev-list --merges origin/premium/frontend..HEAD  # must print nothing
   git diff --stat origin/premium/frontend...HEAD
   git diff origin/premium/frontend...HEAD
   git diff --check
   ```

   Every added commit must correspond to a selected source SHA with a `-x`
   trailer; compare each resulting patch with its source, especially after
   conflict resolution. An empty merge list alone is insufficient: a branch
   created from `main` could also contain many unapproved linear commits.

5. Push the topic branch and open a PR with **base `premium/frontend`**, label
   `premium:promotion`, and title such as `premium: promote login fix`. In the PR
   body, record one row per source commit:

   | Source SHA / source PR | Reason and dependencies | Result SHA on Premium |
   | --- | --- | --- |
   | Full original SHA and PR link | Why Premium needs it; selected prerequisite SHAs or “none” | Fill after merge |

   Include conflict resolutions, the expected Premium backend/CE-library
   version, affected feature keys, and validation evidence. Under
   [ADR-002](04_decisions/ADR-002-feature-registry.md), every new control must be
   gated by the feature key supplied by the backend that implements its endpoint;
   a missing key stays disabled. Promoting UI does not update Premium's Maven pin.

6. Wait for all required checks and independent maintainer approval. If the
   target advances, rebase the topic branch onto the latest
   `origin/premium/frontend`, resolve conflicts, and obtain fresh checks/review.
   Never merge `main` to make the PR current. Merge with **Rebase and merge**;
   do not squash away individual source trailers.

7. Fetch the updated `premium/frontend`. Because rebasing changes commit IDs,
   find the final commits by their source trailers and fill the PR table's result
   SHAs. Link the promotion PR from each source PR and apply `premium:promoted`
   there only when all intended commits from that PR have landed. For partial
   promotion, leave the label off and list exactly which SHAs were included.
   The SHA table and trailers are the audit record; labels are discovery aids.

To check a source SHA later, search the branch log, then inspect any matching
promotion and subsequent reverts:

```sh
git log origin/premium/frontend --fixed-strings --grep="cherry picked from commit $SOURCE_SHA"
```

“Promoted” means accepted onto the branch, not deployed. The Premium release
record must separately link the promotion PR, resolved frontend SHA, backend
version and immutable image digest. Record rollbacks/reverts there and on the
promotion PR; a historical label alone is not evidence of current deployment.

## Switch the Premium build (maintainer, private repository)

Make a separate reviewed change in
`munichdeveloper/n8n-instance-manager-premium`. Its files are unavailable in this
checkout, so the following is an integration template, not a patch against a
verified Premium workflow.

1. Find **every** frontend source path: cross-repository checkout, clone/archive
   download, submodule, Docker build stage, cached source or prebuilt image. Change
   the source from Controla `main` to `refs/heads/premium/frontend`; remove any
   fallback to `main`. Keep Premium's own repository checkout separate.
2. For an Actions checkout, use an explicit repository, ref and destination. For
   example, after checking out the Premium repository, add:

   ```yaml
   - name: Check out approved shared frontend
     uses: actions/checkout@v4
     with:
       repository: munichdeveloper/controla
       ref: refs/heads/premium/frontend
       path: community-frontend
       persist-credentials: false
   - name: Record resolved frontend source
     id: frontend-source
     run: echo "sha=$(git -C community-frontend rev-parse HEAD)" >> "$GITHUB_OUTPUT"
   - uses: actions/setup-node@v4
     with:
       node-version-file: community-frontend/frontend/.nvmrc
       cache: npm
       cache-dependency-path: community-frontend/frontend/package-lock.json
   - name: Build approved frontend
     working-directory: community-frontend/frontend
     env:
       NEXT_PUBLIC_BACKEND_BASE_URL: /api
       BACKEND_URL: http://localhost:8081/api
     run: |
       npm install --global npm@11.9.0
       npm ci
       npm run build
   ```

   Match the npm pin to the selected branch's tooling when it changes. Adapt
   backend URLs to Premium's actual topology; Next rewrites are set at build
   time. Resolve the branch **once per build** and record
   `${{ steps.frontend-source.outputs.sha }}` with the release artifact. If another
   job needs the source, pass that exact SHA rather than resolving the branch
   again. A missing branch or failed checkout must fail the build.
3. Wire the actual packaging to this checkout. For a Docker build, copy
   `community-frontend/frontend/` into the frontend builder's context (including
   `package-lock.json` and configuration) and run `npm ci` and the build there, or
   package the artifacts built above. Do not overlay it onto a leftover `main`
   tree. Copy `.next/standalone` and `.next/static` from that same build, plus
   `public/` if present. Preserve `LICENSE` and `NOTICE`. The
   [Community Dockerfile](../Dockerfile) shows the current standalone layout;
   Premium must continue packaging its own backend.
4. Key source/build caches by the resolved frontend SHA and lockfile. Record the
   SHA in build logs and release metadata, and verify it matches the protected
   branch revision selected for this run. Deploy the tested immutable image;
   do not rebuild by re-resolving the moving branch during deployment or retry.
5. Run Premium's build/integration checks and real Premium staging checks before
   production: login/logout, tenant separation, license/feature gates, API
   rewrites and Premium features affected by the promotion. See the
   [frontend rollout guidance](DEPENDENCY_UPGRADE.md#gestufter-rollout-und-rückkehr).
   Verify that a new `main`-only commit does not change Premium's resolved source,
   and that an approved promotion does.

For deployment rollback, redeploy the previously tested immutable Premium image
and record its frontend SHA. To undo a promotion on the branch, create a topic
branch from `premium/frontend`, use `git revert <promoted-result-sha>` (dependents
first if necessary), and submit it through the same review/check gates. Link the
original source and promotion PR; never reset or force-push the protected branch.

## Manual activation checklist

- [ ] Maintainer verifies and records the deployed/approved baseline SHA, then creates `premium/frontend` in this repository.
- [ ] Maintainer configures and verifies all branch protection rules above, enables rebase merging, and creates the two tracking labels.
- [ ] Maintainer confirms a PR targeting `premium/frontend` runs all three required Test jobs and is blocked until review/check gates pass.
- [ ] Maintainer changes every Premium frontend source/packaging path in the private repository, removes `main` fallbacks and records resolved source SHAs.
- [ ] Maintainer validates the branch selection, actual Premium integration and staging, then switches production to the tested immutable image and records rollback details.

Until those steps are complete, the Premium frontend is not isolated from `main`.
