# Releasing Controla CE

A release is cut by the **Release** workflow (`.github/workflows/release.yml`), not by
creating a GitHub release by hand. The workflow publishes the artifacts first and creates
the tag and the GitHub release last, so a release never exists without its artifacts.

## Cut a release

1. Make sure `main` is green.
2. Open **Actions → Release → Run workflow**, keep the branch on `main` and enter the
   version without a leading `v`, for example `1.3.1`.

The workflow then:

1. rejects a malformed version or an existing tag `v<version>`,
2. sets the POM versions, builds and runs the Maven tests,
3. builds the Docker image and runs the Docker and Hostinger smoke tests,
4. pushes `ghcr.io/munichdeveloper/controla:<version>`,
5. uploads the Maven artifacts to GitHub Packages,
6. creates the tag `v<version>` and the GitHub release with generated notes and the
   executable backend JAR attached,
7. opens a pull request `chore/bump-version-<version>` that aligns the POM versions on
   `main`, and starts the Test workflow for it.

Merge the version bump pull request afterwards. Edit the generated release notes on the
release page if needed.

Do not create a release or push a `v*` tag by hand: neither publishes any artifact.

## Requirements

- **Settings → Actions → General → "Allow GitHub Actions to create and approve pull
  requests"** must be enabled for step 7.

## If a run fails

- **Before step 4:** nothing was published. Fix the cause and run the workflow again.
- **After the Maven upload (step 5):** GitHub Packages does not accept the same version
  twice. Run the workflow again with the same version and tick
  **maven_already_published**; it rebuilds, re-pushes the image and creates the release
  without uploading to GitHub Packages again.
- **In step 7 only:** the release is complete. Open the version bump pull request by hand.
