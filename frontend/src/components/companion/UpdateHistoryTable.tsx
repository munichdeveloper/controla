'use client';

import { useState, useEffect, useCallback } from 'react';
import { getCompanionUpdateHistory } from '@/lib/api';
import { CompanionUpdateHistory } from '@/lib/types';

interface UpdateHistoryTableProps {
  externalId: string;
}

export function UpdateHistoryTable({ externalId }: UpdateHistoryTableProps) {
  const [history, setHistory] = useState<CompanionUpdateHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedError, setExpandedError] = useState<number | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getCompanionUpdateHistory(externalId);
      setHistory(data);
    } catch (err) {
      setError('Fehler beim Laden des Update-Verlaufs');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [externalId]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  if (loading) {
    return <div className="p-4">Lädt…</div>;
  }

  if (error) {
    return (
      <div className="p-4 bg-danger/5 text-danger rounded">
        {error}
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="p-4 text-center text-muted">
        Noch keine Updates durchgeführt.
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return 'bg-primary/10 text-primary';
      case 'FAILED':
        return 'bg-danger/10 text-danger';
      case 'IN_PROGRESS':
        return 'bg-warning/10 text-warning';
      default:
        return 'bg-soft text-foreground';
    }
  };

  const getTriggerColor = (trigger: string) => {
    switch (trigger) {
      case 'AUTO':
        return 'bg-soft text-foreground';
      case 'MANUAL':
        return 'bg-soft text-foreground';
      case 'SCHEDULED':
        return 'bg-soft text-foreground';
      default:
        return 'bg-soft text-foreground';
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <table className="w-full">
        <thead className="bg-background border-b border-border">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Datum</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Von</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Nach</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Status</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Auslöser</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {history.map((entry) => (
            <tr key={entry.id} className="hover:bg-background">
              <td className="px-4 py-3 text-sm text-foreground">
                {new Date(entry.executedAt).toLocaleString('de-DE')}
              </td>
              <td className="px-4 py-3 text-sm font-mono text-muted">
                {entry.fromVersion}
              </td>
              <td className="px-4 py-3 text-sm font-mono text-muted">
                {entry.toVersion}
              </td>
              <td className="px-4 py-3 text-sm">
                <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getStatusColor(entry.status)}`}>
                  {entry.status === 'SUCCESS' ? '✓' : entry.status === 'FAILED' ? '✗' : '⟳'} {entry.status}
                </span>
              </td>
              <td className="px-4 py-3 text-sm">
                <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getTriggerColor(entry.triggerType)}`}>
                  {entry.triggerType}
                </span>
              </td>
              {entry.status === 'FAILED' && entry.errorMessage && (
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => setExpandedError(expandedError === entry.id ? null : entry.id)}
                    className="text-xs text-muted hover:text-muted"
                  >
                    {expandedError === entry.id ? '▼' : '▶'}
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Error Details (expandable) */}
      {expandedError !== null && (
        <div className="border-t border-border bg-danger/5 p-4">
          <p className="text-xs text-muted font-semibold mb-1">Fehlermeldung:</p>
          <p className="text-xs text-danger font-mono">
            {history.find((h) => h.id === expandedError)?.errorMessage}
          </p>
        </div>
      )}
    </div>
  );
}

