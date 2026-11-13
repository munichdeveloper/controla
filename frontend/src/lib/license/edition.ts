import type { LicenseInfo } from '../types';

/** Umbrella name of the hosted offer; its tariffs are Solo and Agency. */
export const HOSTED_OFFER_NAME = 'Managed Hosting';

const PLAN_LABELS: Record<string, string> = { solo: 'Solo', agency: 'Agency' };

/**
 * Visible edition name. Hosted tenants see their tariff (Solo/Agency) once the
 * authenticated license names it; otherwise the umbrella name of the hosted offer.
 * The raw `edition` string stays an internal compatibility key (see entitlements.ts).
 */
export function editionLabel(license: LicenseInfo | null, isPremium: boolean): string {
  if (!isPremium) return license?.edition || 'Community Edition';
  return (license?.plan && PLAN_LABELS[license.plan]) || HOSTED_OFFER_NAME;
}
