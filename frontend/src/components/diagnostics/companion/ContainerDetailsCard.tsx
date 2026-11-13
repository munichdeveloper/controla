'use client';

import { useQuery } from '@tanstack/react-query';
import { getCompanionContainer } from '@/lib/api';
import { BUTTON_SECONDARY, CARD, CARD_TITLE, formatBytes } from '@/lib/diagnostics/format';
import type { CompanionServiceSummary } from '@/lib/types';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm border-b border-border last:border-0">
      <span className="text-muted">{label}</span>
      <span className="font-mono text-foreground text-right break-all">{children}</span>
    </div>
  );
}

interface Props {
  externalId: string;
  service: string;
  services: CompanionServiceSummary[];
  onServiceChange: (service: string) => void;
}

export function ContainerDetailsCard({ externalId, service, services, onServiceChange }: Props) {
  const summary = services.find((s) => s.service === service);
  const hasContainer = !!summary?.container;
  const { data, error, isFetching, refetch } = useQuery({
    queryKey: ['companionContainer', externalId, service],
    queryFn: () => getCompanionContainer(externalId, service),
    enabled: hasContainer,
  });

  return (
    <div className={CARD}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={`${CARD_TITLE} mb-0`}>Services &amp; Container</h3>
        <button onClick={() => refetch()} disabled={isFetching || !hasContainer} className={BUTTON_SECONDARY}>
          {isFetching ? 'Lädt…' : 'Aktualisieren'}
        </button>
      </div>

      <div className="mb-6 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left font-mono text-[10px] uppercase tracking-wide text-muted">
              <th className="py-2 pr-4">Service</th>
              <th className="py-2 pr-4">Zustand</th>
              <th className="py-2 pr-4">Health</th>
              <th className="py-2 pr-4">Exit-Code</th>
              <th className="py-2">Image</th>
            </tr>
          </thead>
          <tbody>
            {services.map((s) => (
              <tr
                key={s.service}
                onClick={() => onServiceChange(s.service)}
                className={`cursor-pointer border-t border-border ${
                  s.service === service ? 'bg-primary/20' : 'hover:bg-background'
                }`}
              >
                <td className="py-2 pr-4 font-medium text-foreground">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onServiceChange(s.service);
                    }}
                    aria-pressed={s.service === service}
                    className="text-left hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                  >
                    {s.service}
                  </button>
                </td>
                <td className={`py-2 pr-4 ${s.state === 'running' ? 'text-primary' : 'text-danger'}`}>
                  {s.state ?? 'kein Container'}
                </td>
                <td className="py-2 pr-4 text-muted">{s.health ?? '–'}</td>
                <td className="py-2 pr-4 text-muted">{s.state && s.state !== 'running' ? s.exitCode ?? '–' : '–'}</td>
                <td className="py-2 font-mono text-xs text-muted">{s.image ?? '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!hasContainer && <p className="text-sm text-muted">Für „{service}“ existiert kein Container.</p>}
      {error && <p className="text-sm text-danger">Details konnten nicht geladen werden: {(error as Error).message}</p>}

      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h4 className="text-sm font-semibold text-muted mb-2">Zustand von {data.name}</h4>
            <Row label="Status">{data.state.status ?? 'unbekannt'}</Row>
            <Row label="Exit-Code">{data.state.exitCode ?? '–'}</Row>
            <Row label="Durch OOM beendet">{data.state.oomKilled ? 'ja' : 'nein'}</Row>
            <Row label="Neustarts">{data.restartCount}</Row>
            <Row label="Restart-Policy">{data.restartPolicy ?? '–'}</Row>
            <Row label="Healthcheck">
              {data.state.health ? `${data.state.health.status} (Fehlversuche in Folge: ${data.state.health.failingStreak})` : 'nicht definiert'}
            </Row>
            <Row label="Gestartet">{data.state.startedAt ?? '–'}</Row>
            <Row label="Beendet">{data.state.finishedAt ?? '–'}</Row>
            {data.state.error && <Row label="Fehler">{data.state.error}</Row>}
            <Row label="Speicherlimit">{data.limits.memoryBytes ? formatBytes(data.limits.memoryBytes) : 'kein Limit'}</Row>
            <Row label="CPU-Limit">{data.limits.cpus ?? 'kein Limit'}</Row>
            <Row label="Image">{data.image ?? '–'}</Row>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-muted mb-2">Konfiguration</h4>
            <Row label="Ports">
              {data.ports.length === 0 ? '–' : data.ports.map((p) => `${p.hostPort ? `${p.hostPort}→` : ''}${p.containerPort}`).join(', ')}
            </Row>
            <Row label="Netzwerke">{data.networks.join(', ') || '–'}</Row>
            <Row label="Volumes">{data.mounts.map((m) => `${m.source ?? '?'} → ${m.destination ?? '?'}${m.rw ? '' : ' (ro)'}`).join(', ') || '–'}</Row>
            {data.state.health && data.state.health.lastChecks.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-muted mb-1">Letzte Healthchecks</p>
                <pre className="p-2 bg-background rounded text-xs font-mono overflow-auto max-h-32 text-muted">
                  {data.state.health.lastChecks.map((c) => `${c.start ?? ''} exit=${c.exitCode ?? '?'} ${c.output}`).join('\n')}
                </pre>
              </div>
            )}
            <details className="mt-3">
              <summary className="text-xs text-primary cursor-pointer">
                Umgebungsvariablen ({data.env.length}, Werte geheimer Variablen maskiert)
              </summary>
              <div className="mt-2 max-h-48 overflow-auto">
                {data.env.map((e) => (
                  <Row key={e.key} label={e.key}>
                    {e.masked ? '••••••' : e.value}
                  </Row>
                ))}
              </div>
            </details>
          </div>
        </div>
      )}
    </div>
  );
}
