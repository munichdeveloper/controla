'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCompanionDiagnosticServices, getCompanionStatus } from '@/lib/api';
import { useLicense } from '@/lib/license/LicenseContext';
import { FEATURES } from '@/lib/license/features';
import { COMPANION_CAPABILITIES as CAP, companionSectionState, worstState } from '@/lib/diagnostics/gating';
import { BUTTON_SECONDARY, CARD } from '@/lib/diagnostics/format';
import { CompanionPrerequisiteNotice } from './CompanionPrerequisiteNotice';
import { ContainerDetailsCard } from './ContainerDetailsCard';
import { ContainerLogViewer } from './ContainerLogViewer';
import { ContainerResourcesPanel } from './ContainerResourcesPanel';
import { ContainerEventsTimeline } from './ContainerEventsTimeline';
import { SupportBundleButton } from './SupportBundleButton';

interface Props {
  externalId: string;
  onOpenCompanionTab?: () => void;
}

/**
 * Companion-based diagnostics. Every section is gated by companionSectionState:
 * backend feature key, companion configured/reachable, companion capability.
 */
export function CompanionDiagnosticsSection({ externalId, onOpenCompanionTab }: Props) {
  const { isFeatureEnabled } = useLicense();
  const [service, setService] = useState('n8n');

  const anyFeature = [
    FEATURES.COMPANION_DIAG_CONTAINER,
    FEATURES.COMPANION_DIAG_LOGS,
    FEATURES.COMPANION_DIAG_STATS,
    FEATURES.COMPANION_DIAG_EVENTS,
    FEATURES.COMPANION_DIAG_BUNDLE,
  ].some((key) => isFeatureEnabled(key));

  const {
    data: status,
    error: statusError,
    refetch: refetchStatus,
    isFetching: statusFetching,
  } = useQuery({
    queryKey: ['companionDiagnosticsStatus', externalId],
    queryFn: () => getCompanionStatus(externalId),
    enabled: anyFeature,
    staleTime: 30_000,
  });

  const states = {
    container: companionSectionState(isFeatureEnabled(FEATURES.COMPANION_DIAG_CONTAINER), status, [CAP.SERVICES, CAP.CONTAINER]),
    logs: companionSectionState(isFeatureEnabled(FEATURES.COMPANION_DIAG_LOGS), status, [CAP.SERVICES, CAP.LOGS]),
    stats: companionSectionState(isFeatureEnabled(FEATURES.COMPANION_DIAG_STATS), status, [CAP.SERVICES, CAP.STATS]),
    events: companionSectionState(isFeatureEnabled(FEATURES.COMPANION_DIAG_EVENTS), status, [CAP.SERVICES, CAP.EVENTS]),
    bundle: companionSectionState(isFeatureEnabled(FEATURES.COMPANION_DIAG_BUNDLE), status, [CAP.CONTAINER]),
  };
  const hostReady = companionSectionState(isFeatureEnabled(FEATURES.COMPANION_DIAG_STATS), status, [CAP.HOST]) === 'ready';
  const servicesNeeded = [states.container, states.logs, states.stats, states.events].includes('ready');

  const { data: services, error: servicesError } = useQuery({
    queryKey: ['companionServices', externalId],
    queryFn: () => getCompanionDiagnosticServices(externalId),
    enabled: servicesNeeded,
  });

  if (!anyFeature) return null;

  const notice = worstState(Object.values(states));
  const allReadyOrHidden = Object.values(states).every((s) => s === 'ready' || s === 'hidden');
  const serviceList = services?.services ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Container-Diagnose (Companion)</h3>
        {states.bundle === 'ready' && <SupportBundleButton externalId={externalId} />}
      </div>

      {statusError && !status && (
        <div className={CARD}>
          <p className="text-sm text-red-600 dark:text-red-400">
            Companion-Status konnte nicht geladen werden: {(statusError as Error).message}
          </p>
          <button onClick={() => refetchStatus()} disabled={statusFetching} className={`${BUTTON_SECONDARY} mt-3`}>
            {statusFetching ? 'Lädt…' : 'Erneut versuchen'}
          </button>
        </div>
      )}

      {!allReadyOrHidden && !(statusError && !status) && (
        <CompanionPrerequisiteNotice state={notice} companionVersion={status?.companionVersion} onOpenCompanionTab={onOpenCompanionTab} />
      )}

      {servicesError && (
        <p className="text-sm text-red-600 dark:text-red-400">Services konnten nicht geladen werden: {(servicesError as Error).message}</p>
      )}
      {states.container === 'ready' && services && (
        <ContainerDetailsCard externalId={externalId} service={service} services={serviceList} onServiceChange={setService} />
      )}
      {states.container !== 'ready' && servicesNeeded && serviceList.length > 1 && (
        <select value={service} onChange={(e) => setService(e.target.value)} className="px-2 py-1.5 text-sm border rounded-md dark:bg-zinc-800 dark:text-white dark:border-zinc-600" aria-label="Service">
          {serviceList.map((s) => (
            <option key={s.service} value={s.service}>
              {s.service}
            </option>
          ))}
        </select>
      )}
      {states.logs === 'ready' && <ContainerLogViewer externalId={externalId} service={service} />}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {states.stats === 'ready' && <ContainerResourcesPanel externalId={externalId} service={service} showHost={hostReady} />}
        {states.events === 'ready' && <ContainerEventsTimeline externalId={externalId} service={service} />}
      </div>
    </div>
  );
}
