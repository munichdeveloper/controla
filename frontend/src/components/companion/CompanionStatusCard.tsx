'use client';

import { CompanionStatus } from '@/lib/types';

interface CompanionIndicatorProps {
  externalId: string;
  status: CompanionStatus | null;
  label?: string;
}

export function CompanionIndicatorDot({ status, label = 'Companion' }: CompanionIndicatorProps) {
  if (!status?.configured) {
    return null;
  }

  const isConnected = status.connected;
  const color = isConnected ? 'bg-green-500' : 'bg-red-500';
  const tooltip = isConnected ? 'Companion verbunden' : 'Companion nicht erreichbar';

  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-3 h-3 rounded-full ${color} animate-pulse`}
        title={tooltip}
      />
      <span className="text-xs text-gray-600 dark:text-gray-400">{label}</span>
    </div>
  );
}

interface CompanionStatusCardProps {
  status: CompanionStatus | null;
  loading?: boolean;
}

export function CompanionStatusCard({ status, loading }: CompanionStatusCardProps) {
  if (!status?.configured) {
    return null;
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg border border-gray-200 dark:border-zinc-700 animate-pulse">
        <div className="h-4 bg-gray-200 dark:bg-zinc-700 rounded w-1/3 mb-4"></div>
        <div className="space-y-3">
          <div className="h-3 bg-gray-200 dark:bg-zinc-700 rounded w-1/2"></div>
          <div className="h-3 bg-gray-200 dark:bg-zinc-700 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  const containerStatusColor =
    status.containerStatus === 'running'
      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      : status.containerStatus === 'exited'
        ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
        : status.containerStatus === 'stopped'
          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
          : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';

  return (
    <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg border border-gray-200 dark:border-zinc-700">
      <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
        Companion-Status
      </h3>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold mb-1">
            Container-Status
          </p>
          <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${containerStatusColor}`}>
            {status.containerStatus}
          </span>
        </div>

        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold mb-1">
            Verbindung
          </p>
          <span
            className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
              status.connected
                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
            }`}
          >
            {status.connected ? '✓ Verbunden' : '✗ Nicht erreichbar'}
          </span>
        </div>

        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold mb-1">
            Gepinnte Version
          </p>
          <p className="text-sm font-mono font-semibold text-gray-900 dark:text-white">
            {status.pinnedVersion || '–'}
          </p>
        </div>

        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold mb-1">
            Laufende Version
          </p>
          <p className="text-sm font-mono font-semibold text-gray-900 dark:text-white">
            {status.runningVersion || '–'}
          </p>
        </div>

        {status.updating && (
          <div className="col-span-2 mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-700 dark:text-blue-400">
              <span className="animate-spin mr-2">⟳</span>
              Update läuft ({status.updatePhase || 'verarbeitet'})
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

