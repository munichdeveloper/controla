import type { LicenseInfo } from '../types';

// These endpoints exist in the pre-entitlement Premium backend. Keep that exact
// compatibility contract; every other missing feature still fails closed.
const legacyKeys = ['workflow.import', 'backup.scheduled', 'companion.manage'];
export function featureEnabled(license: LicenseInfo | null, key: string): boolean {
  if (!license) return false;
  if (license.tenantBound === false) return false;
  if (Object.prototype.hasOwnProperty.call(license.features, key)) return license.features[key] === true;
  // tenantBound/plan only exist on entitlement-aware backends; there an omitted key means denied.
  const modernResponse = license.tenantBound !== undefined || license.plan !== undefined;
  const legacyPremium = !modernResponse && ['Hosted Ops', 'Premium Edition'].includes(license.edition);
  return legacyPremium && legacyKeys.includes(key)
    && legacyKeys.every((known) => !Object.prototype.hasOwnProperty.call(license.features, known));
}

/**
 * CE shows paid features as locked with an upgrade hint. Hosted editions (Solo/Agency) hide
 * features the booked plan does not include instead of advertising them to paying customers.
 */
export function showsLockedFeatures(license: LicenseInfo | null): boolean {
  return !isHostedEdition(license);
}

// 'Hosted Ops' / 'Premium Edition' are internal edition keys of hosted backends, not display names.
export function isHostedEdition(license: LicenseInfo | null): boolean {
  return license?.edition === 'Hosted Ops' || license?.edition === 'Premium Edition';
}
