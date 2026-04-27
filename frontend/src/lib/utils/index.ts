// Utility-Funktionen
import { format, formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

type VersionIdentifier = number | string;
type ParsedVersion = {
  core: number[];
  prerelease: VersionIdentifier[];
};

function isKnownVersion(version: string | null | undefined): version is string {
  return Boolean(version && version.trim() && version.trim().toLowerCase() !== 'unknown');
}

function parseVersionIdentifier(identifier: string): VersionIdentifier {
  return /^\d+$/.test(identifier) ? Number(identifier) : identifier.toLowerCase();
}

function parseVersion(version: string): ParsedVersion | null {
  const normalizedVersion = version.trim().replace(/^v/i, '');
  const [versionWithoutBuildMetadata] = normalizedVersion.split('+');
  const prereleaseSeparatorIndex = versionWithoutBuildMetadata.indexOf('-');
  const corePart = prereleaseSeparatorIndex === -1
    ? versionWithoutBuildMetadata
    : versionWithoutBuildMetadata.slice(0, prereleaseSeparatorIndex);
  const prereleasePart = prereleaseSeparatorIndex === -1
    ? undefined
    : versionWithoutBuildMetadata.slice(prereleaseSeparatorIndex + 1);

  if (!corePart) return null;

  const core = corePart.split('.');
  if (core.some(part => !/^\d+$/.test(part))) {
    return null;
  }

  return {
    core: core.map(Number),
    prerelease: prereleasePart
      ? prereleasePart
          .split('.')
          .filter(Boolean)
          .map(parseVersionIdentifier)
      : [],
  };
}

function comparePrereleaseIdentifiers(left: VersionIdentifier, right: VersionIdentifier): number {
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right;
  }

  if (typeof left === 'number') return -1;
  if (typeof right === 'number') return 1;

  return left.localeCompare(right);
}

export function compareVersions(leftVersion: string, rightVersion: string): number | null {
  const left = parseVersion(leftVersion);
  const right = parseVersion(rightVersion);

  if (!left || !right) {
    return leftVersion.trim() === rightVersion.trim() ? 0 : null;
  }

  const maxCoreLength = Math.max(left.core.length, right.core.length);
  for (let index = 0; index < maxCoreLength; index += 1) {
    const leftPart = left.core[index] ?? 0;
    const rightPart = right.core[index] ?? 0;

    if (leftPart !== rightPart) {
      return leftPart - rightPart;
    }
  }

  const leftHasPrerelease = left.prerelease.length > 0;
  const rightHasPrerelease = right.prerelease.length > 0;

  if (!leftHasPrerelease && !rightHasPrerelease) return 0;
  if (!leftHasPrerelease) return 1;
  if (!rightHasPrerelease) return -1;

  const maxPrereleaseLength = Math.max(left.prerelease.length, right.prerelease.length);
  for (let index = 0; index < maxPrereleaseLength; index += 1) {
    const leftIdentifier = left.prerelease[index];
    const rightIdentifier = right.prerelease[index];

    if (leftIdentifier === undefined) return -1;
    if (rightIdentifier === undefined) return 1;

    const result = comparePrereleaseIdentifiers(leftIdentifier, rightIdentifier);
    if (result !== 0) {
      return result;
    }
  }

  return 0;
}

export function getVersionUpdateState(
  version: string | null | undefined,
  latestVersion: string | null | undefined
): 'up-to-date' | 'update-available' | null {
  if (!isKnownVersion(version) || !isKnownVersion(latestVersion)) {
    return null;
  }

  const comparison = compareVersions(version, latestVersion);

  if (comparison === null) {
    return version.trim() === latestVersion.trim() ? 'up-to-date' : null;
  }

  return comparison < 0 ? 'update-available' : 'up-to-date';
}

/**
 * Formatiert ein ISO-Datum in ein lesbares deutsches Format
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return 'Nie';

  try {
    const date = new Date(dateString);
    return format(date, 'dd.MM.yyyy HH:mm', { locale: de });
  } catch {
    return 'Ungültig';
  }
}

/**
 * Formatiert ein ISO-Datum als "vor X Minuten/Stunden/Tagen"
 */
export function formatRelativeTime(dateString: string | null | undefined): string {
  if (!dateString) return 'Nie';

  try {
    const date = new Date(dateString);
    return formatDistanceToNow(date, { addSuffix: true, locale: de });
  } catch {
    return 'Ungültig';
  }
}

/**
 * Gibt CSS-Klassen für Status-Badge zurück
 */
export function getStatusColor(status: string): string {
  switch (status?.toLowerCase()) {
    case 'online':
      return 'bg-green-100 text-green-800';
    case 'offline':
      return 'bg-red-100 text-red-800';
    case 'locked':
      return 'bg-amber-100 text-amber-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

/**
 * Gibt CSS-Klassen für Severity-Badge zurück
 */
export function getSeverityColor(severity: string): string {
  switch (severity?.toUpperCase()) {
    case 'ERROR':
      return 'bg-red-100 text-red-800';
    case 'WARNING':
      return 'bg-yellow-100 text-yellow-800';
    case 'INFO':
      return 'bg-blue-100 text-blue-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

