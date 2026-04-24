'use client';

import { useState } from 'react';
import {
  startCompanionContainer,
  stopCompanionContainer,
  pullCompanionImage,
  pinCompanionVersion,
} from '@/lib/api';

interface ManagementActionBarProps {
  externalId: string;
  updating: boolean;
  onActionComplete: () => void;
}

export function ManagementActionBar({ externalId, updating, onActionComplete }: ManagementActionBarProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<string | null>(null);
  const [versionToPin, setVersionToPin] = useState<string>('');

  const handleAction = async (
    action: () => Promise<{ success: boolean; output: string }>,
    name: string
  ) => {
    try {
      setLoading(true);
      setError(null);
      setOutput(null);
      const result = await action();
      setOutput(result.output);
      onActionComplete();
      alert(`${name} erfolgreich ausgeführt`);
    } catch (err: any) {
      setError(`Fehler bei ${name}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg border border-gray-200 dark:border-zinc-700">
      <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
        Management-Aktionen
      </h3>

      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded">
          {error}
        </div>
      )}

      {output && (
        <div className="mb-4 p-4 bg-gray-50 dark:bg-zinc-800 rounded font-mono text-xs overflow-auto max-h-32 text-gray-700 dark:text-gray-300">
          {output}
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-4">
        <button
          onClick={() => handleAction(() => stopCompanionContainer(externalId), 'Stop')}
          disabled={loading || updating}
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Stop
        </button>
        <button
          onClick={() => handleAction(() => startCompanionContainer(externalId), 'Start')}
          disabled={loading || updating}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Start
        </button>
        <button
          onClick={() => handleAction(() => pullCompanionImage(externalId), 'Pull')}
          disabled={loading || updating}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Pull
        </button>
      </div>

      <div className="flex gap-3">
        <input
          type="text"
          placeholder="z.B. 1.90.2"
          value={versionToPin}
          onChange={(e) => setVersionToPin(e.target.value)}
          disabled={loading || updating}
          className="flex-1 px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md dark:bg-zinc-800 dark:text-white focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
        />
        <button
          onClick={() => {
            if (versionToPin) {
              handleAction(() => pinCompanionVersion(externalId, versionToPin), 'Version pinnen').then(() => {
                setVersionToPin('');
              });
            }
          }}
          disabled={loading || updating || !versionToPin}
          className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Version pinnen
        </button>
      </div>
    </div>
  );
}

