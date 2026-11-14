'use client';

import { useState } from 'react';
import { FEATURES } from '@/lib/license/features';
import { useLicense } from '@/lib/license/LicenseContext';
import { CompanionSettingsPanel } from './CompanionSettingsPanel';
import { CompanionStatusCard, CompanionIndicatorDot } from './CompanionStatusCard';
import { UpdateProgressOverlay } from './UpdateProgressOverlay';
import { UpdateActionPanel } from './UpdateActionPanel';
import { ManagementActionBar } from './ManagementActionBar';
import { UpdateHistoryTable } from './UpdateHistoryTable';
import { useCompanionStatusPoller } from './useCompanionStatusPoller';

interface CompanionSectionProps {
  externalId: string;
}

export function CompanionSection({ externalId }: CompanionSectionProps) {
  const { isFeatureEnabled, loading: licenseLoading } = useLicense();
  const companionEnabled = isFeatureEnabled(FEATURES.COMPANION_MANAGE);
  const [updateKey, setUpdateKey] = useState(0);

  // Polling für Status
  const { status, isPolling } = useCompanionStatusPoller(externalId, !licenseLoading && companionEnabled);

  // Trigger Statusaktualisierung nach Update
  const handleUpdateStarted = () => {
    setUpdateKey((k) => k + 1);
  };

  // Premium-Guard
  if (licenseLoading) {
    return <div className="p-4">Lädt…</div>;
  }

  if (!companionEnabled) {
    return null;
  }

  return (
    <div className="space-y-6" key={updateKey}>
      {/* Update Progress Overlay */}
      <UpdateProgressOverlay
        isVisible={status?.updating || false}
        updatePhase={status?.updatePhase}
      />

      {/* Companion Settings */}
      <CompanionSettingsPanel externalId={externalId} />

      {/* Companion Status Card */}
      <CompanionStatusCard status={status} loading={isPolling} />

      {/* Update Actions */}
      {status?.configured && (
        <UpdateActionPanel
          externalId={externalId}
          updating={status?.updating || false}
          onUpdateStarted={handleUpdateStarted}
        />
      )}

      {/* Management Actions */}
      {status?.configured && (
        <ManagementActionBar
          externalId={externalId}
          updating={status?.updating || false}
          onActionComplete={handleUpdateStarted}
        />
      )}

      {/* Update History */}
      {status?.configured && (
        <div>
          <h3 className="text-lg font-semibold mb-4 text-foreground">
            Update-Verlauf
          </h3>
          <UpdateHistoryTable externalId={externalId} />
        </div>
      )}
    </div>
  );
}

export function CompanionIndicator({ externalId }: { externalId: string }) {
  const { isFeatureEnabled, loading: licenseLoading } = useLicense();
  const companionEnabled = isFeatureEnabled(FEATURES.COMPANION_MANAGE);
  const { status } = useCompanionStatusPoller(externalId, !licenseLoading && companionEnabled);

  if (licenseLoading || !companionEnabled) {
    return null;
  }

  return <CompanionIndicatorDot externalId={externalId} status={status} label="Companion" />;
}

