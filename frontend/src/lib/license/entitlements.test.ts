import { describe, expect, it } from 'vitest';
import { featureEnabled } from './entitlements';
import type { LicenseInfo } from '../types';

const license = (features: Record<string, boolean>, edition = 'Premium Edition'): LicenseInfo =>
  ({ edition, maxInstances: 10, features });
describe('server entitlements and version compatibility', () => {
  it('keeps unlimited Community capacity separate from paid feature rights', () => {
    const community: LicenseInfo = { edition: 'Community Edition', maxInstances: -1, features: { 'diagnostics.report': true } };
    expect(featureEnabled(community, 'diagnostics.report')).toBe(true);
    for (const key of ['workflow.import', 'backup.scheduled', 'companion.manage', 'alert.workflow_error', 'alert.api_key_invalid'])
      expect(featureEnabled(community, key)).toBe(false);
  });
  it('honors explicit denial even for a premium edition', () => {
    expect(featureEnabled(license({ 'workflow.import': false }), 'workflow.import')).toBe(false);
    expect(featureEnabled(license({ 'workflow.import': true }), 'workflow.import')).toBe(true);
  });
  it('preserves only the three guaranteed pre-entitlement endpoints', () => {
    for (const key of ['workflow.import', 'backup.scheduled', 'companion.manage'])
      expect(featureEnabled(license({}), key)).toBe(true);
    expect(featureEnabled(license({}), 'companion.diagnostics.logs')).toBe(false);
    expect(featureEnabled(license({}), 'future.feature')).toBe(false);
  });
  it('fails closed for CE, loading and a partial entitlement payload', () => {
    expect(featureEnabled({ ...license({ 'workflow.import': true }), tenantBound: false }, 'workflow.import')).toBe(false);
    expect(featureEnabled(null, 'workflow.import')).toBe(false);
    expect(featureEnabled(license({}, 'Community Edition'), 'workflow.import')).toBe(false);
    expect(featureEnabled(license({ 'backup.scheduled': false }), 'workflow.import')).toBe(false);
  });
});
