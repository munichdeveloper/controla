'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getCompanionUpdateSettings,
  updateCompanionUpdateSettings,
  startCompanionUpdate,
  scheduleCompanionUpdate,
  cancelScheduledUpdate,
  getCompanionVersions,
} from '@/lib/api';
import { CompanionUpdateSettings } from '@/lib/types';

interface UpdateActionPanelProps {
  externalId: string;
  updating: boolean;
  onUpdateStarted: () => void;
}

export function UpdateActionPanel({ externalId, updating, onUpdateStarted }: UpdateActionPanelProps) {
  const [settings, setSettings] = useState<CompanionUpdateSettings | null>(null);
  const [versions, setVersions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<string>('');
  const [scheduledDate, setScheduledDate] = useState<string>('');
  const [hasScheduled, setHasScheduled] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [settingsData, versionsData] = await Promise.all([
        getCompanionUpdateSettings(externalId),
        getCompanionVersions(externalId),
      ]);
      setSettings(settingsData);
      setAutoUpdateEnabled(settingsData.autoUpdateEnabled);
      setVersions(versionsData.versions);
      if (settingsData.scheduledUpdateAt) {
        setScheduledDate(settingsData.scheduledUpdateAt);
        setHasScheduled(true);
      }
    } catch (err) {
      setError('Fehler beim Laden der Update-Einstellungen');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [externalId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleAutoUpdateToggle = async () => {
    try {
      setSaving(true);
      setError(null);
      const newSettings = {
        autoUpdateEnabled: !autoUpdateEnabled,
        scheduledUpdateAt: settings?.scheduledUpdateAt || null,
      };
      await updateCompanionUpdateSettings(externalId, newSettings);
      setAutoUpdateEnabled(!autoUpdateEnabled);
      setSettings(newSettings);
    } catch (err) {
      setError('Fehler beim Speichern der Auto-Update-Einstellung');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleManualUpdate = async () => {
    try {
      setSaving(true);
      setError(null);
      await startCompanionUpdate(externalId, selectedVersion);
      onUpdateStarted();
      alert('Update gestartet');
    } catch (err: any) {
      if (err.status === 409) {
        setError('Ein Update läuft bereits');
      } else {
        setError('Fehler beim Starten des Updates');
      }
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleScheduleUpdate = async () => {
    if (!scheduledDate) {
      setError('Bitte wählen Sie ein Datum und eine Uhrzeit');
      return;
    }
    try {
      setSaving(true);
      setError(null);
      const isoDate = new Date(scheduledDate).toISOString();
      await scheduleCompanionUpdate(externalId, isoDate);
      setHasScheduled(true);
      alert('Update geplant');
    } catch (err) {
      setError('Fehler beim Planen des Updates');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelScheduled = async () => {
    try {
      setSaving(true);
      setError(null);
      await cancelScheduledUpdate(externalId);
      setHasScheduled(false);
      setScheduledDate('');
      alert('Geplantes Update storniert');
    } catch (err) {
      setError('Fehler beim Stornieren des Updates');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-4">Lädt...</div>;
  }

  return (
    <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg border border-gray-200 dark:border-zinc-700">
      <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
        Update-Einstellungen
      </h3>

      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {/* Auto-Update */}
        <div className="border-b border-gray-200 dark:border-zinc-700 pb-6">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="autoUpdate"
              checked={autoUpdateEnabled}
              onChange={handleAutoUpdateToggle}
              disabled={saving || updating}
              className="mt-1 w-4 h-4 text-emerald-600 dark:accent-emerald-500 rounded"
            />
            <div className="flex-1">
              <label htmlFor="autoUpdate" className="text-sm font-medium text-gray-900 dark:text-white cursor-pointer">
                Automatisch auf neueste Version aktualisieren
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Auto-Update installiert immer die semantisch höchste verfügbare Version, auch wenn diese noch nicht als stable markiert ist.
              </p>
            </div>
          </div>
        </div>

        {/* Manual Update */}
        <div className="border-b border-gray-200 dark:border-zinc-700 pb-6">
          <h4 className="font-medium text-gray-900 dark:text-white mb-3">Sofortiges Update</h4>
          <div className="flex gap-3">
            <select
              value={selectedVersion}
              onChange={(e) => setSelectedVersion(e.target.value)}
              disabled={saving || updating}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md dark:bg-zinc-800 dark:text-white focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="">Version wählen (optional)</option>
              {versions.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            <button
              onClick={handleManualUpdate}
              disabled={saving || updating}
              className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Wird…' : 'Jetzt'}
            </button>
          </div>
        </div>

        {/* Scheduled Update */}
        <div>
          <h4 className="font-medium text-gray-900 dark:text-white mb-3">Geplantes Update</h4>
          {hasScheduled ? (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-md mb-3">
              <p className="text-sm text-blue-800 dark:text-blue-400">
                Update geplant für: <strong>{new Date(scheduledDate).toLocaleString('de-DE')}</strong>
              </p>
            </div>
          ) : null}
          <div className="flex gap-3">
            <input
              type="datetime-local"
              value={scheduledDate.split('T')[0] && scheduledDate.split('T')[1] ? scheduledDate.split('T').join('T').substring(0, 16) : ''}
              onChange={(e) => setScheduledDate(e.target.value)}
              disabled={saving || updating || hasScheduled}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md dark:bg-zinc-800 dark:text-white focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
            />
            <button
              onClick={hasScheduled ? handleCancelScheduled : handleScheduleUpdate}
              disabled={saving || updating}
              className={`px-4 py-2 rounded-md text-white ${
                hasScheduled
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {saving ? 'Wird…' : hasScheduled ? 'Stornieren' : 'Planen'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

