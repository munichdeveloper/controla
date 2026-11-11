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
