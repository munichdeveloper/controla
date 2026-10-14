'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { downloadCompanionLogs, getCompanionLogs, saveBlob } from '@/lib/api';
import { BUTTON_SECONDARY, CARD, CARD_TITLE, SELECT } from '@/lib/diagnostics/format';

const TAILS = [200, 500, 1000, 5000];
const RANGES = [
  { value: '15m', label: '15 Minuten' },
  { value: '1h', label: '1 Stunde' },
  { value: '6h', label: '6 Stunden' },
  { value: '24h', label: '24 Stunden' },
  { value: '7d', label: '7 Tage' },
];

interface Props {
  externalId: string;
  service: string;
}

export function ContainerLogViewer({ externalId, service }: Props) {
  const [tail, setTail] = useState(500);
  const [since, setSince] = useState('1h');
  const [filter, setFilter] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const { data, error, isFetching, refetch } = useQuery({
    queryKey: ['companionLogs', externalId, service, tail, since],
    queryFn: () => getCompanionLogs(externalId, { service, tail, since }),
  });

  const findingsByLine = useMemo(() => {
    const map = new Map<number, string>();
    (data?.findings ?? []).forEach((f) => map.set(f.line, `${f.title}: ${f.hint}`));
    return map;
  }, [data]);

  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    return (data?.lines ?? [])
      .map((line, index) => ({ line, index }))
      .filter(({ line }) => !needle || line.message.toLowerCase().includes(needle));
  }, [data, filter]);

  const download = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      saveBlob(await downloadCompanionLogs(externalId, { service, tail, since }), `${externalId}-${service}.log`);
    } catch (err) {
      setDownloadError((err as Error).message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className={CARD}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className={`${CARD_TITLE} mb-0`}>Logs: {service}</h3>
        <div className="flex flex-wrap items-center gap-2">
          <select value={since} onChange={(e) => setSince(e.target.value)} className={SELECT} aria-label="Zeitraum">
            {RANGES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <select value={tail} onChange={(e) => setTail(Number(e.target.value))} className={SELECT} aria-label="Zeilen">
            {TAILS.map((t) => (
              <option key={t} value={t}>
                {t} Zeilen
              </option>
            ))}
          </select>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtern…"
            aria-label="Logzeilen filtern"
            className={`${SELECT} w-40`}
          />
          <button onClick={() => refetch()} disabled={isFetching} className={BUTTON_SECONDARY}>
            {isFetching ? 'Lädt…' : 'Aktualisieren'}
          </button>
          <button onClick={download} disabled={downloading} className={BUTTON_SECONDARY}>
            {downloading ? 'Lädt…' : 'Herunterladen'}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400 mb-2">Logs konnten nicht geladen werden: {(error as Error).message}</p>}
      {downloadError && <p className="text-sm text-red-600 dark:text-red-400 mb-2">{downloadError}</p>}

      {data && data.findings.length > 0 && (
        <div className="mb-3 space-y-2">
          {data.findings.slice(0, 5).map((f) => (
            <div key={`${f.patternId}-${f.line}`} className={`p-3 rounded text-sm ${f.severity === 'FAIL' ? 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300' : 'bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300'}`}>
              <span className="font-semibold">{f.title}</span> – {f.hint}
            </div>
          ))}
        </div>
      )}

      <div className="bg-gray-900 rounded-lg p-3 font-mono text-xs max-h-[28rem] overflow-auto">
        {data && visible.length === 0 && <p className="text-gray-400">Keine Logzeilen{filter ? ' für diesen Filter' : ''}.</p>}
        {visible.map(({ line, index }) => (
          <div
            key={index}
            title={findingsByLine.get(index)}
            className={`whitespace-pre-wrap ${findingsByLine.has(index) ? 'bg-red-900/40 text-red-200' : line.stream === 'stderr' ? 'text-amber-300' : 'text-green-300'}`}
          >
            <span className="text-gray-500">{line.ts ? line.ts.replace('T', ' ').slice(0, 23) : ''} </span>
            {line.message}
          </div>
        ))}
      </div>
      {data && (
        <p className="text-xs text-gray-500 dark:text-zinc-400 mt-2">
          {data.lines.length} Zeilen{data.truncated ? ' (gekürzt)' : ''}
          {data.redacted ? (
            ' · Werte geheimer Variablen sind maskiert.'
          ) : (
            <span className="text-amber-700 dark:text-amber-400"> · Achtung: Diese Logs wurden nicht maskiert und können Secrets enthalten.</span>
          )}
        </p>
      )}
    </div>
  );
}
