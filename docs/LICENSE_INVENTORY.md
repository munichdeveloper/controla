# License inventory and relicensing readiness

**State: evidence collection only (2026-11-06).** The effective Controla CE license remains **AGPLv3** (`LICENSE.md`). The investigation of Apache-2.0 as an alternative is tracked in [#47](https://github.com/munichdeveloper/controla/issues/47) and [#49](https://github.com/munichdeveloper/controla/issues/49).

The [License inventory workflow](../.github/workflows/license-inventory.yml) generates two downloadable CI artifacts when manually triggered or when dependency / license files change:

| Artifact | Content |
| --- | --- |
| `license-inventory-maven-and-authors` | Aggregate Maven CycloneDX JSON, a human-readable license metadata report, distinct Git author names and Co-authored-by trailers |
| `license-inventory-npm` | npm CycloneDX JSON plus a human-readable license metadata report for the frontend dependency graph |

### How to run

In GitHub Actions select **License inventory (advisory)** and choose **Run workflow** (after this workflow is merged). To test the workflow before merging, open its PR and inspect its PR checks and artifacts.

Equivalent commands for local use:

```bash
mvn -B -ntp org.cyclonedx:cyclonedx-maven-plugin:2.9.3:makeAggregateBom -Dcyclonedx.outputFormat=json
# Expected aggregate output: target/bom.json

cd frontend
npm ci --ignore-scripts
npm sbom --sbom-format=cyclonedx --sbom-type=application > ../ce-npm.cdx.json
```

### Important limitations and required manual checks

- **Metadata reports are leads, not legal opinions.** Reports group declared license labels and identify dependencies with missing license metadata; they do not independently verify the license texts or determine compatibility.
- **An SBOM is not a legal opinion.** Missing, conflicting or inaccurate license metadata requires review; the job does not classify a license as approved or relicense any code.
- **Commit names are not a copyright-clearance result.** Check original author rights, outside contributions, co-authored material, copy/pasted snippets, and the specific terms accepted with each contribution. Confirm the scope of the current `CONTRIBUTING.md` license grant through legal review.
- **Build-time dependency metadata is not the entire distribution.** Inspect the built executable JAR, the Next.js standalone bundle and its included packages, npm optional/native dependencies, and both the Linux and JVM/Node runtime base images.
- **Inventory non-package assets:** fonts, icons, images, documentation quotations and any vendored files. They may be governed by independent licenses, regardless of Maven/npm metadata.
- **Historical releases:** any already-distributed AGPLv3 version stays subject to its valid license. A future license switch does not revoke existing downstream rights.
- **Proprietary packages:** the CE library integrated into a private executable must have a sufficient, documented independent rights grant before proprietary redistribution. A private repository by itself does not provide such rights.
- **Brand:** Apache-2.0/MIT licensing of code would not automatically license the Controla trademark.
- **No license switch until an explicit, recorded decision and legal Go/No-Go.**

Recommended follow-up: produce a human-reviewable table for every distribution component (component name, version, declared license(s), evidence URL, intended usage, obligations, reviewer, decision), then record unresolved items as issues. For generated artifact manifests, retain the run URL and commit SHA in the review record.

Primary references: [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0), [Apache guidance for applying the license](https://www.apache.org/legal/apply-license.html), [GNU AGPLv3](https://www.gnu.org/licenses/agpl-3.0.en.html).
