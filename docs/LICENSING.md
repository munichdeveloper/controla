# Controla CE licensing

## Current license

The Controla Community Edition source code, documentation and first-party
assets in this repository are offered under **Apache License, Version 2.0**.
The authoritative text is [LICENSE](../LICENSE). The copyright and attribution
notice is in [NOTICE](../NOTICE).

**Historical versions remain under the terms under which they were received.**
In particular, code distributed as Controla CE under AGPLv3 is not retroactively
withdrawn or relicensed for its prior recipients. This new license applies to
the newly distributed version of the repository. The project owner has approved
the license policy transition on 2026-11-06.

### License versus product entitlement

The Apache-2.0 license allows use, modification, redistribution and proprietary
derivative works under its terms. It does **not** obligate commercial service
operators to provide hosting, support, maintenance, incident management or paid
extensions. Runtime feature keys and service quotas define which functions a
given installation or contract provides; they are **not software copyright
restrictions** on the Apache-2.0 Community Edition.

### Premium integrations

A proprietary backend can incorporate the Apache-2.0 Community Edition by
complying with Apache-2.0 redistribution obligations and other applicable
licenses. Commercial distribution still needs its own EULA/terms, third-party
notices, security commitments and support scope. No right to the Controla
trademark is granted by the source-code license.

### Contributor rights

Contributions accepted after this policy transition are submitted under
Apache-2.0 according to [CONTRIBUTING.md](../CONTRIBUTING.md). Earlier
contributions require confirmation of the relevant rights to the extent needed
for a new release. The maintainers must not remove third-party attribution.
When an additional individual contributor license agreement (CLA) is necessary,
its terms must be separately and explicitly accepted. Existing pull-request
submissions alone do not establish rights beyond those actually granted.

### Distribution checklist

- Include a full copy of Apache-2.0 LICENSE and applicable NOTICE in
  distributed source and binary/JAR/Docker artifacts.
- Retain copyright, patent, trademark and attribution notices as required.
- Document changes to licensed upstream files when redistributed.
- Produce and review Maven/npm SBOMs using
  [license-inventory.yml](../.github/workflows/license-inventory.yml).
- Check **runtime** transitive dependencies, container base images, and assets
  against the **actual** shipped artifact; not all dependencies in the SBOM ship.
- Maintain separate license evidence and notices for any third-party content.
- Require approval of release artifacts and their provenance checks.

The inventory workflow is evidence collection, not legal certification.
