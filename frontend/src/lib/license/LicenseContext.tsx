'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { getLicenseInfo } from '../api';
import { LicenseInfo } from '../types';
import { featureEnabled } from './entitlements';
import { editionLabel } from './edition';
import { useAuth } from '../auth/AuthContext';
import type { LoginResponse } from '../api';

interface LicenseContextType {
  license: LicenseInfo | null;
  loading: boolean;
  error: boolean;
  isFeatureEnabled: (feature: string) => boolean;
  isPremium: boolean;
  maxInstances: number;
}

const LicenseContext = createContext<LicenseContextType | undefined>(undefined);

export function LicenseProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [loadedFor, setLoadedFor] = useState<LoginResponse | null | undefined>(undefined);
  const [license, setLicense] = useState<LicenseInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    setLicense(null);
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(() => controller.abort(), 5000);

    getLicenseInfo(controller.signal, !!user)
      .then((info) => {
        if (active) setLicense(info);
      })
      .catch((err) => {
        if (active) {
          setError(true);
          console.error('Failed to fetch license info', err);
        }
      })
      .finally(() => {
        clearTimeout(timeout);
        if (active) { setLoadedFor(user); setLoading(false); }
      });

    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [user]);

  const currentLicense = loadedFor === user ? license : null;
  const isFeatureEnabled = (feature: string) => {
    return featureEnabled(currentLicense, feature);
  };

  // 'Hosted Ops' / 'Premium Edition' are internal edition keys of hosted backends, not display names.
  const isPremium = currentLicense?.edition === 'Hosted Ops' || currentLicense?.edition === 'Premium Edition';
  const label = currentLicense?.edition ? editionLabel(currentLicense, isPremium) : null;

  useEffect(() => {
    if (label) document.title = `Controla - ${label}`;
  }, [label]);
  const maxInstances = currentLicense?.tenantBound === false ? 0 : (currentLicense?.maxInstances ?? 0);

  return (
    <LicenseContext.Provider value={{ license: currentLicense, loading: loading || loadedFor !== user, error, isFeatureEnabled, isPremium, maxInstances }}>
      {children}
    </LicenseContext.Provider>
  );
}

export function useLicense() {
  const context = useContext(LicenseContext);
  if (context === undefined) {
    throw new Error('useLicense must be used within a LicenseProvider');
  }
  return context;
}
