'use client';

import { useQuery } from '@tanstack/react-query';
import { getCompanionHost, getCompanionStats } from '@/lib/api';
import { CARD, CARD_TITLE, formatBytes } from '@/lib/diagnostics/format';

function Meter({ label, percent, text }: { label: string; percent: number | null; text: string }) {
  const value = percent === null ? 0 : Math.min(100, Math.max(0, percent));
  const color = value >= 95 ? 'bg-danger' : value >= 85 ? 'bg-warning' : 'bg-primary';
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-muted">{label}</span>
        <span className="font-mono text-foreground">{text}</span>
      </div>
      <div className="h-2 bg-soft rounded">
        <div className={`h-2 rounded ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

interface Props {
  externalId: string;
  service: string;
  /** true only when the companion reports diagnostics.host */
  showHost: boolean;
}

export function ContainerResourcesPanel({ externalId, service, showHost }: Props) {
  const stats = useQuery({
    queryKey: ['companionStats', externalId, service],
    queryFn: () => getCompanionStats(externalId, service),
    refetchInterval: 5000,
  });
  const host = useQuery({
    queryKey: ['companionHost', externalId],
    queryFn: () => getCompanionHost(externalId),
    enabled: showHost,
    staleTime: 60_000,
  });

  const s = stats.data;
  const memPercent = s?.memPercent ?? null;

  return (
    <div className={CARD}>
      <h3 className={CARD_TITLE}>Ressourcen: {service}</h3>
      {stats.error && <p className="text-sm text-danger">Werte konnten nicht geladen werden: {(stats.error as Error).message}</p>}
      {s && (
        <div className="space-y-4">
          <Meter label="CPU" percent={s.cpuPercent} text={s.cpuPercent === null ? '–' : `${s.cpuPercent.toFixed(1)} %`} />
          <Meter
            label="Arbeitsspeicher"
            percent={memPercent}
            text={`${formatBytes(s.memUsageBytes)} / ${formatBytes(s.memLimitBytes)}${memPercent === null ? '' : ` (${memPercent.toFixed(1)} %)`}`}
          />
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted">Netzwerk</p>
              <p className="font-mono text-foreground">↓ {formatBytes(s.netRxBytes)} ↑ {formatBytes(s.netTxBytes)}</p>
            </div>
            <div>
              <p className="text-muted">Block-I/O</p>
              <p className="font-mono text-foreground">{formatBytes(s.blockReadBytes)} / {formatBytes(s.blockWriteBytes)}</p>
            </div>
            <div>
              <p className="text-muted">Prozesse</p>
              <p className="font-mono text-foreground">{s.pids ?? '–'}</p>
            </div>
          </div>
          <p className="text-xs text-muted">Momentaufnahme, aktualisiert alle 5 Sekunden.</p>
        </div>
      )}

      {showHost && host.data && (
        <div className="mt-6 pt-4 border-t border-border space-y-4">
          <h4 className="text-sm font-semibold text-muted">Host &amp; Speicherplatz</h4>
          {host.data.filesystems.map((fs) => {
            const used = fs.totalBytes > 0 ? ((fs.totalBytes - fs.freeBytes) / fs.totalBytes) * 100 : null;
            return (
              <Meter
                key={fs.label}
                label={fs.label === 'n8n-data' ? `n8n-Daten (${fs.path})` : `Compose-Verzeichnis (${fs.path})`}
                percent={used}
                text={`${formatBytes(fs.freeBytes)} frei von ${formatBytes(fs.totalBytes)}`}
              />
            );
          })}
          {host.data.docker && (
            <p className="text-xs text-muted">
              Docker {host.data.docker.serverVersion} · Compose {host.data.compose.version ?? '?'} · {host.data.docker.os} · {host.data.docker.cpus} CPUs ·{' '}
              {formatBytes(host.data.docker.memTotalBytes)} RAM
            </p>
          )}
          {host.data.warnings.length > 0 && (
            <ul className="text-xs text-warning list-disc pl-4">
              {host.data.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
