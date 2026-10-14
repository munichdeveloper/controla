'use client';

import { useQuery } from '@tanstack/react-query';
import { getDiagnosticSnapshot } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { formatBytes } from '@/lib/diagnostics/format';

interface Props {
  externalId: string;
  snapshotId: number;
  onClose: () => void;
}

/** Diagnostic snapshot captured when an incident started (Premium). */
export function DiagnosticSnapshotDialog({ externalId, snapshotId, onClose }: Props) {
  const { data, error, isLoading } = useQuery({
    queryKey: ['diagnosticSnapshot', externalId, snapshotId],
    queryFn: () => getDiagnosticSnapshot(externalId, snapshotId),
  });
  const payload = data?.payload;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-700 max-w-4xl w-full max-h-[90vh] overflow-auto p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="diagnostic-snapshot-title"
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 id="diagnostic-snapshot-title" className="text-lg font-semibold text-gray-900 dark:text-white">
              Diagnose-Snapshot
            </h3>
            {data && (
              <p className="text-xs text-gray-500 dark:text-zinc-400">
                Erfasst {formatDate(data.capturedAt)}
                {data.companionVersion ? ` · Companion ${data.companionVersion}` : ''}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-800 dark:text-zinc-400 dark:hover:text-zinc-100">
            Schließen
          </button>
        </div>

        {isLoading && <p className="text-sm text-gray-500 dark:text-zinc-400">Lädt…</p>}
        {error && <p className="text-sm text-red-600 dark:text-red-400">Snapshot konnte nicht geladen werden: {(error as Error).message}</p>}
        {data?.error && (
          <div className="mb-4 p-3 rounded bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300 text-sm">
            Beim Erfassen war der Companion nicht vollständig erreichbar: {data.error}. Das spricht dafür, dass der Host oder das Netzwerk insgesamt
            betroffen war.
          </div>
        )}

        {payload?.container && (
          <div className="mb-4 text-sm">
            <h4 className="font-semibold text-gray-700 dark:text-zinc-300 mb-1">Container {payload.container.name}</h4>
            <p className="text-gray-700 dark:text-zinc-300">
              Status {payload.container.state.status ?? 'unbekannt'} · Exit-Code {payload.container.state.exitCode ?? '–'} · OOM{' '}
              {payload.container.state.oomKilled ? 'ja' : 'nein'} · Neustarts {payload.container.restartCount} · Limit{' '}
              {payload.container.limits.memoryBytes ? formatBytes(payload.container.limits.memoryBytes) : 'keins'}
            </p>
          </div>
        )}

        {payload?.events && payload.events.events.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-1">Docker-Ereignisse</h4>
            <ul className="text-xs font-mono text-gray-700 dark:text-zinc-300 space-y-0.5">
              {payload.events.events.map((e, i) => (
                <li key={i}>
                  {e.time} {e.action}
                  {e.exitCode !== null ? ` exit=${e.exitCode}` : ''}
                  {e.healthStatus ? ` ${e.healthStatus}` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}

        {payload?.logs && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-1">Letzte Logzeilen</h4>
            <pre className="bg-gray-900 text-green-300 rounded p-3 text-xs font-mono max-h-80 overflow-auto whitespace-pre-wrap">
              {payload.logs.lines.map((l) => `${l.ts ?? ''} ${l.message}`).join('\n') || 'Keine Logzeilen.'}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
