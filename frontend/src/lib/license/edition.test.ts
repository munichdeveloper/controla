import { describe, expect, it } from 'vitest';
import { editionLabel } from './edition';
import type { LicenseInfo } from '../types';

const license = (edition: string, plan?: string): LicenseInfo => ({ edition, plan, maxInstances: 10, features: {} });

describe('editionLabel', () => {
  it('shows the tariff of hosted tenants', () => {
    expect(editionLabel(license('Premium Edition', 'solo'), true)).toBe('Solo');
    expect(editionLabel(license('Premium Edition', 'agency'), true)).toBe('Agency');
  });

  it('falls back to the hosted offer name without a known tariff', () => {
    expect(editionLabel(license('Premium Edition'), true)).toBe('Managed Hosting');
    expect(editionLabel(license('Premium Edition', 'unassigned'), true)).toBe('Managed Hosting');
    expect(editionLabel(license('Premium Edition', 'legacy'), true)).toBe('Managed Hosting');
    expect(editionLabel(license('Hosted Ops'), true)).toBe('Managed Hosting');
  });

  it('keeps the Community edition name', () => {
    expect(editionLabel(license('Community Edition'), false)).toBe('Community Edition');
    expect(editionLabel(null, false)).toBe('Community Edition');
  });
});
