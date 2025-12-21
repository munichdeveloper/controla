'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { getLicenseInfo } from '../api';
import { LicenseInfo } from '../types';
import { useAuth } from '../auth/AuthContext';

interface LicenseContextType {
  license: LicenseInfo | null;
  loading: boolean;
  isFeatureEnabled: (feature: string) => boolean;
  isPremium: boolean;
  maxInstances: number;
}

const LicenseContext = createContext<LicenseContextType | undefined>(undefined);

export function LicenseProvider({ children }: { children: React.ReactNode }) {
  const [license, setLicense] = useState<LicenseInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    getLicenseInfo()
      .then((info) => {
        setLicense(info);
      })
      .catch((err) => {
        console.error('Failed to fetch license info', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (license?.edition) {
      document.title = `n8n Instance Manager - ${license.edition}`;
    }
  }, [license]);

  const isFeatureEnabled = (feature: string) => {
    if (!license) return false;
    return !!license.features[feature];
  };

  const isPremium = license?.edition === 'Business Edition' || license?.edition === 'Premium Edition';
  const maxInstances = license?.maxInstances ?? 3;

  return (
    <LicenseContext.Provider value={{ license, loading, isFeatureEnabled, isPremium, maxInstances }}>
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
