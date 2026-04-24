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
      <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded">
        {error}
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
        Noch keine Updates durchgeführt.
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'FAILED':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'IN_PROGRESS':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  const getTriggerColor = (trigger: string) => {
    switch (trigger) {
      case 'AUTO':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'MANUAL':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
      case 'SCHEDULED':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700 overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Datum</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Von</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Nach</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Status</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Auslöser</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-zinc-700">
          {history.map((entry) => (
            <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
              <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                {new Date(entry.executedAt).toLocaleString('de-DE')}
              </td>
              <td className="px-4 py-3 text-sm font-mono text-gray-700 dark:text-gray-300">
                {entry.fromVersion}
              </td>
              <td className="px-4 py-3 text-sm font-mono text-gray-700 dark:text-gray-300">
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
                    className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
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
        <div className="border-t border-gray-200 dark:border-zinc-700 bg-red-50 dark:bg-red-900/10 p-4">
          <p className="text-xs text-gray-600 dark:text-gray-400 font-semibold mb-1">Fehlermeldung:</p>
          <p className="text-xs text-red-700 dark:text-red-400 font-mono">
            {history.find((h) => h.id === expandedError)?.errorMessage}
          </p>
        </div>
      )}
    </div>
  );
}

