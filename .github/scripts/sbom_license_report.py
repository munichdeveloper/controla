#!/usr/bin/env python3
"""Human-readable CycloneDX license metadata inventory; not legal clearance."""

import json
import sys
from collections import Counter
from pathlib import Path


def license_labels(component):
    declared = []
    for entry in component.get("licenses", []) or []:
        if not isinstance(entry, dict):
            continue
        expression = entry.get("expression")
        details = entry.get("license") or {}
        label = expression or details.get("id") or details.get("name") or details.get("url")
        if label:
            declared.append(str(label))
    return sorted(set(declared)) or ["NOT DECLARED"]


def cell(value):
    return str(value).replace("|", r"\|").replace("\n", " ")


def main():
    if len(sys.argv) != 3:
        raise SystemExit("Usage: sbom_license_report.py INPUT.json OUTPUT.md")
    source, target = map(Path, sys.argv[1:])
    bom = json.loads(source.read_text(encoding="utf-8"))
    if bom.get("bomFormat") != "CycloneDX":
        raise SystemExit("Expected CycloneDX SBOM")
    components = bom.get("components") or []
    if not components:
        raise SystemExit("SBOM has no components")

    rows = []
    tags = Counter()
    for component in components:
        licenses = license_labels(component)
        for label in licenses:
            tags[label] += 1
        rows.append((
            str(component.get("name") or "unnamed"),
            str(component.get("version") or "unspecified"),
            str(component.get("purl") or ""),
            ", ".join(licenses),
            "NOT DECLARED" in licenses,
        ))
    rows.sort(key=lambda row: (row[0].lower(), row[1]))
    missing = [row for row in rows if row[-1]]
    lines = [
        "# CycloneDX dependency license metadata",
        "",
        f"Source: `{source.name}` (generated CI artifact).",
        f"Components: **{len(rows)}**. No declared license: **{len(missing)}**.",
        "",
        "**Important:** Package metadata is not a confirmed license, a verified",
        "rights chain, or a compatibility decision. Review the actual distributed",
        "artifacts, linked license texts, copied source/assets, and policy obligations.",
        "",
        "## Reported license labels",
        "",
        "| Label | Components |",
        "| --- | ---: |",
    ]
    lines.extend(f"| {cell(label)} | {count} |" for label, count in sorted(tags.items()))
    lines.extend([
        "",
        "## Components without a declared license",
        "",
        "| Component | Version | PURL |",
        "| --- | --- | --- |",
    ])
    lines.extend(
        f"| {cell(name)} | {cell(version)} | {cell(purl)} |"
        for name, version, purl, _, _ in missing
    )
    if not missing:
        lines.append("| None indicated by the supplied metadata | — | — |")
    lines.extend([
        "",
        "## Full dependency inventory",
        "",
        "| Component | Version | License metadata | PURL |",
        "| --- | --- | --- | --- |",
    ])
    lines.extend(
        f"| {cell(name)} | {cell(version)} | {cell(licenses)} | {cell(purl)} |"
        for name, version, purl, licenses, _ in rows
    )
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"{source.name}: {len(rows)} components, {len(missing)} missing license metadata")


if __name__ == "__main__":
    main()
