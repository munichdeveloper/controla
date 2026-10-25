'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { getLicenseInfo } from '../api';
import { LicenseInfo } from '../types';

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
  const [license, setLicense] = useState<LicenseInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(() => controller.abort(), 5000);

    getLicenseInfo(controller.signal)
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
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (license?.edition) {
      document.title = `Controla - ${license.edition}`;
    }
  }, [license]);

  const isFeatureEnabled = (feature: string) => {
    if (!license) return false;
    return !!license.features[feature];
  };

  const isPremium = license?.edition === 'Hosted Ops' || license?.edition === 'Premium Edition';
  const maxInstances = license?.maxInstances ?? 3;

  return (
    <LicenseContext.Provider value={{ license, loading, error, isFeatureEnabled, isPremium, maxInstances }}>
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
