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
    <div className="bg-card p-6 rounded-xl border border-border">
      <h3 className="text-lg font-semibold mb-4 text-foreground">
        Management-Aktionen
      </h3>

      {error && (
        <div className="mb-4 p-4 bg-danger/5 text-danger rounded">
          {error}
        </div>
      )}

      {output && (
        <div className="mb-4 p-4 bg-background rounded font-mono text-xs overflow-auto max-h-32 text-muted">
          {output}
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-4">
        <button
          onClick={() => handleAction(() => stopCompanionContainer(externalId), 'Stop')}
          disabled={loading || updating}
          className="px-4 py-2 bg-danger text-on-primary rounded-lg hover:bg-danger/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Stop
        </button>
        <button
          onClick={() => handleAction(() => startCompanionContainer(externalId), 'Start')}
          disabled={loading || updating}
          className="px-4 py-2 bg-primary text-on-primary rounded-lg hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Start
        </button>
        <button
          onClick={() => handleAction(() => pullCompanionImage(externalId), 'Pull')}
          disabled={loading || updating}
          className="px-4 py-2 border border-border bg-card text-foreground hover:bg-soft rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
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
          className="flex-1 px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-primary focus:border-primary"
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
          className="px-4 py-2 bg-primary text-on-primary rounded-lg hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Version pinnen
        </button>
      </div>
    </div>
  );
}

