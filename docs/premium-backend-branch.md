# Premium backend branch

Premium (`munichdeveloper/n8n-instance-manager-premium`) uses this repository's
`backend` module as a Maven library. It no longer pins Community Edition
releases. Instead it pins a library built from the protected branch
`premium/backend`, which only receives selected commits from `main` by
cherry-pick. CE releases from `main` continue as before (docs/RELEASE.md) and
do not reach Premium automatically.

The frontend works the same way with `premium/frontend`; see
[premium-frontend-branch.md](premium-frontend-branch.md). The rules there
(provenance, `-x` trailers, no merge commits, Rebase and merge) apply here too.

## Branch and protection

- `premium/backend` started at tag `v1.3.0`, the version Premium pinned before.
- The repository ruleset that protects `premium/frontend` also covers
  `premium/backend`: no deletion, no force push, linear history, changes only by
  pull request, required checks `test-backend`, `test-frontend`, `test-docker`.

## Library versions

[premium-backend-publish.yml](../.github/workflows/premium-backend-publish.yml)
exists only on `premium/backend`. Every push to the branch (that is, every
merged promotion PR) builds and tests the backend and publishes
`de.atstck.controla.ce:backend` to GitHub Packages as
`<CE base>-premium.<run number>`, for example `1.3.0-premium.2`. The CE base is
the newest `v*` tag reachable from the branch. The run summary shows the exact
version.

To ship it, change the pinned version in Premium's `pom.xml` in a PR. Merging
that PR deploys Premium to production.

## Promote selected backend changes

1. **Actions → Premium backend promote → Run workflow** on `main`, with the
   merged `main` PR numbers, oldest dependency first.
2. [premium-backend-promote.yml](../.github/workflows/premium-backend-promote.yml)
   cherry-picks their commits with `-x` onto a `promote-backend/...` branch,
   refuses commits touching `frontend/` unless `allow_frontend` is set, opens a
   PR against `premium/backend` labelled `premium-backend:promotion`, and starts
   the required checks. On a conflict it stops; then follow the manual steps in
   premium-frontend-branch.md with `premium/backend` as the target.
3. Review, wait for green checks, merge with **Rebase and merge**.
4. [premium-backend-labels.yml](../.github/workflows/premium-backend-labels.yml)
   labels each fully promoted source PR `premium-backend:promoted`, and the
   publish workflow releases the next `-premium.N` version.
5. Bump the pin in Premium.

Commits that change both `backend/` and `frontend/` must be split on `main`
first, or promoted to each branch with the respective `allow_*` option.
