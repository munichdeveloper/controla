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
  const color = isConnected ? 'bg-primary' : 'bg-danger';
  const tooltip = isConnected ? 'Companion verbunden' : 'Companion nicht erreichbar';

  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-3 h-3 rounded-full ${color} animate-pulse`}
        title={tooltip}
      />
      <span className="text-xs text-muted">{label}</span>
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
      <div className="bg-card p-6 rounded-xl border border-border animate-pulse">
        <div className="h-4 bg-soft rounded w-1/3 mb-4"></div>
        <div className="space-y-3">
          <div className="h-3 bg-soft rounded w-1/2"></div>
          <div className="h-3 bg-soft rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  const containerStatusColor =
    status.containerStatus === 'running'
      ? 'bg-primary/10 text-primary'
      : status.containerStatus === 'exited'
        ? 'bg-danger/10 text-danger'
        : status.containerStatus === 'stopped'
          ? 'bg-warning/10 text-warning'
          : 'bg-soft text-foreground';

  return (
    <div className="bg-card p-6 rounded-xl border border-border">
      <h3 className="text-lg font-semibold mb-4 text-foreground">
        Companion-Status
      </h3>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="font-mono text-[10px] text-muted uppercase tracking-wide mb-1">
            Container-Status
          </p>
          <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${containerStatusColor}`}>
            {status.containerStatus}
          </span>
        </div>

        <div>
          <p className="font-mono text-[10px] text-muted uppercase tracking-wide mb-1">
            Verbindung
          </p>
          <span
            className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
              status.connected
                ? 'bg-primary/10 text-primary'
                : 'bg-danger/10 text-danger'
            }`}
          >
            {status.connected ? '✓ Verbunden' : '✗ Nicht erreichbar'}
          </span>
        </div>

        <div>
          <p className="font-mono text-[10px] text-muted uppercase tracking-wide mb-1">
            Gepinnte Version
          </p>
          <p className="text-sm font-mono font-semibold text-foreground">
            {status.pinnedVersion || '–'}
          </p>
        </div>

        <div>
          <p className="font-mono text-[10px] text-muted uppercase tracking-wide mb-1">
            Laufende Version
          </p>
          <p className="text-sm font-mono font-semibold text-foreground">
            {status.runningVersion || '–'}
          </p>
        </div>

        {status.updating && (
          <div className="col-span-2 mt-2 p-3 bg-soft rounded-md border border-border">
            <p className="text-sm text-foreground">
              <span className="animate-spin mr-2">⟳</span>
              Update läuft ({status.updatePhase || 'verarbeitet'})
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

