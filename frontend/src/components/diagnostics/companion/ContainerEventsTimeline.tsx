'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCompanionEvents } from '@/lib/api';
import { BUTTON_SECONDARY, CARD, CARD_TITLE, SELECT } from '@/lib/diagnostics/format';
import { formatDate } from '@/lib/utils';
import type { CompanionContainerEvent } from '@/lib/types';

const ACTION_LABEL: Record<string, string> = {
  create: 'Erstellt',
  start: 'Gestartet',
  die: 'Beendet',
  kill: 'Signal gesendet',
  oom: 'Speicher erschöpft (OOM)',
  stop: 'Gestoppt',
  restart: 'Neu gestartet',
  health_status: 'Healthcheck',
};

function describe(event: CompanionContainerEvent): string {
  const parts = [ACTION_LABEL[event.action] ?? event.action];
  if (event.exitCode != null) parts.push(`Exit-Code ${event.exitCode}`);
  if (event.signal) parts.push(`Signal ${event.signal}`);
  if (event.healthStatus) parts.push(event.healthStatus);
  return parts.join(' · ');
}

function isBad(event: CompanionContainerEvent): boolean {
  return event.action === 'oom' || (event.action === 'die' && event.exitCode != null && event.exitCode !== 0) || event.healthStatus === 'unhealthy';
}

export function ContainerEventsTimeline({ externalId, service }: { externalId: string; service: string }) {
  const [since, setSince] = useState('24h');
  const { data, error, isFetching, refetch } = useQuery({
    queryKey: ['companionEvents', externalId, service, since],
    queryFn: () => getCompanionEvents(externalId, service, since),
  });
  const events = [...(data?.events ?? [])].reverse();

  return (
    <div className={CARD}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={`${CARD_TITLE} mb-0`}>Docker-Ereignisse: {service}</h3>
        <div className="flex items-center gap-2">
          <select value={since} onChange={(e) => setSince(e.target.value)} className={SELECT} aria-label="Zeitraum">
            <option value="1h">1 Stunde</option>
            <option value="24h">24 Stunden</option>
            <option value="7d">7 Tage</option>
          </select>
          <button onClick={() => refetch()} disabled={isFetching} className={BUTTON_SECONDARY}>
            {isFetching ? 'Lädt…' : 'Aktualisieren'}
          </button>
        </div>
      </div>
      {error && <p className="text-sm text-danger">Ereignisse konnten nicht geladen werden: {(error as Error).message}</p>}
      {data && events.length === 0 && <p className="text-sm text-muted">Keine Ereignisse im Zeitraum.</p>}
      <ol className="space-y-2 max-h-80 overflow-auto">
        {events.map((event, index) => (
          <li key={`${event.time}-${index}`} className="flex gap-3 text-sm">
            <span className="font-mono text-xs text-muted whitespace-nowrap pt-0.5">{formatDate(event.time)}</span>
            <span className={isBad(event) ? 'text-danger font-medium' : 'text-foreground'}>
              {describe(event)}
            </span>
          </li>
        ))}
      </ol>
      <p className="text-xs text-muted mt-3">Docker hält Ereignisse nur begrenzt vor; nach einem Neustart des Docker-Daemons fehlen ältere Einträge.</p>
    </div>
  );
}
