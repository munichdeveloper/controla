'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getBackupSettings, updateBackupSettings, getInstances, getAllLastBackups } from '@/lib/api';
import { useLicense } from '@/lib/license/LicenseContext';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { Skeleton } from '@/components/Skeleton';

export default function BackupSettingsPage() {
  const queryClient = useQueryClient();
  const { isPremium, loading: licenseLoading } = useLicense();

  const [formData, setFormData] = useState({
    enabled: false,
    googleDriveFolderId: '',
    intervalHours: 24,
  });
  const [showSuccess, setShowSuccess] = useState(false);

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['backupSettings'],
    queryFn: getBackupSettings,
    enabled: isPremium,
  });

  const { data: instances } = useQuery({
    queryKey: ['instances'],
    queryFn: getInstances,
    enabled: isPremium,
  });

  const { data: lastBackups } = useQuery({
    queryKey: ['lastBackups'],
    queryFn: getAllLastBackups,
    enabled: isPremium,
  });

  const mutation = useMutation({
    mutationFn: updateBackupSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backupSettings'] });
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    },
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        enabled: settings.enabled,
        googleDriveFolderId: settings.googleDriveFolderId || '',
        intervalHours: settings.intervalHours || 24,
      });
    }
  }, [settings]);

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  if (licenseLoading || (isPremium && settingsLoading)) {
    return (
      <div>
        <div className="mb-6">
          <Skeleton className="h-4 w-32 mb-2" />
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="space-y-6">
          <div className="bg-white dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10 shadow-sm p-6 backdrop-blur-sm">
            <Skeleton className="h-6 w-32 mb-4" />
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="flex items-center justify-between p-2 border border-gray-100 dark:border-white/5 rounded">
                  <div className="flex items-center space-x-3">
                    <Skeleton className="h-2 w-2 rounded-full" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <Skeleton className="h-3 w-24" />
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10 shadow-sm p-6 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <Skeleton className="h-5 w-48 mb-1" />
                <Skeleton className="h-4 w-64" />
              </div>
              <Skeleton className="h-6 w-12 rounded-full" />
            </div>
            <div className="space-y-6">
              <div>
                <Skeleton className="h-4 w-40 mb-1" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-3 w-64 mt-1" />
              </div>
              <div>
                <Skeleton className="h-4 w-48 mb-1" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
            <div className="pt-4 mt-6 border-t border-gray-200 dark:border-white/10 flex justify-end">
              <Skeleton className="h-10 w-32 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isPremium) {
    // ... existing non-premium code ...
    return (
      <div>
        <div className="mb-6">
          <Link href="/" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-emerald-400 text-sm mb-2 inline-block transition-colors">
            ← Zurück zur Übersicht
          </Link>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Backup-Einstellungen</h2>
        </div>

        <div className="bg-white dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10 shadow-sm p-8 max-w-2xl backdrop-blur-sm text-center">
          <div className="mb-6 flex justify-center">
            <div className="p-4 bg-emerald-100 dark:bg-emerald-900/30 rounded-full">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 text-emerald-600 dark:text-emerald-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
              </svg>
            </div>
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Automatische Backups
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Sichern Sie Ihre Workflows automatisch auf Google Drive. Diese Funktion ist exklusiv in der Business Edition verfügbar.
          </p>
          <Link
            href="/premium"
            className="inline-flex items-center px-6 py-3 text-base font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-full transition-colors shadow-lg"
          >
            Jetzt upgraden
          </Link>
        </div>
      </div>
    );
  }


  return (
    <div>
      <div className="mb-6">
        <Link href="/" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-emerald-400 text-sm mb-2 inline-block transition-colors">
          ← Zurück zur Übersicht
        </Link>
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Backup-Einstellungen</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Konfigurieren Sie automatische Backups Ihrer Workflows auf Google Drive
        </p>
      </div>

      <div className="space-y-6">
        <div className="bg-white dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10 shadow-sm p-6 backdrop-blur-sm">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Backup-Status</h3>

          {!instances || instances.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm">Keine Instanzen gefunden.</p>
          ) : (
            <div className="space-y-2">
              {instances.map((instance) => {
                const lastBackup = lastBackups?.[instance.id];
                return (
                  <div key={instance.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-white/5 rounded border border-gray-100 dark:border-white/5">
                    <div className="flex items-center space-x-3 overflow-hidden">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${lastBackup ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                      <div className="truncate">
                        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{instance.name}</div>
                      </div>
                    </div>
                    <div className="text-right whitespace-nowrap ml-4">
                      <div className={`text-xs ${lastBackup ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'}`}>
                        {lastBackup ? (
                          formatDistanceToNow(new Date(lastBackup), { addSuffix: true, locale: de })
                        ) : (
                          'Nie'
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10 shadow-sm p-6 backdrop-blur-sm">
          {showSuccess && (
            <div className="mb-6 bg-green-50 dark:bg-emerald-900/20 border border-green-200 dark:border-emerald-800 rounded-lg p-4">
              <p className="text-green-800 dark:text-emerald-300 font-medium">Einstellungen erfolgreich gespeichert!</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <label htmlFor="enabled" className="text-base font-medium text-gray-900 dark:text-white">
                  Automatische Backups aktivieren
                </label>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Workflows werden regelmäßig exportiert und gesichert
                </p>
              </div>
              <label className="relative inline-block w-12 h-6 transition duration-200 ease-in-out rounded-full cursor-pointer">
                <input
                  type="checkbox"
                  id="enabled"
                  className="sr-only peer"
                  checked={formData.enabled}
                  onChange={(e) => handleChange('enabled', e.target.checked)}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 dark:peer-focus:ring-emerald-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            <div className={`space-y-6 transition-opacity duration-200 ${formData.enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
              <div>
                <label htmlFor="googleDriveFolderId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Google Drive Folder ID
                </label>
                <input
                  type="text"
                  id="googleDriveFolderId"
                  value={formData.googleDriveFolderId}
                  onChange={(e) => handleChange('googleDriveFolderId', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white dark:bg-zinc-900 text-gray-900 dark:text-white"
                  placeholder="z.B. 1A2B3C4D5E6F7G8H9I0J"
                  required={formData.enabled}
                />
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Die ID des Ordners in Google Drive, in dem die Backups gespeichert werden sollen.
                </p>
              </div>

              <div>
                <label htmlFor="intervalHours" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Backup-Intervall (Stunden)
                </label>
                <select
                  id="intervalHours"
                  value={formData.intervalHours}
                  onChange={(e) => handleChange('intervalHours', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white dark:bg-zinc-900 text-gray-900 dark:text-white"
                >
                  <option value={1}>Stündlich</option>
                  <option value={24}>Täglich</option>
                  <option value={168}>Wöchentlich</option>
                  <option value={720}>Monatlich</option>
                </select>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-white/10 flex justify-end">
              <button
                type="submit"
                disabled={mutation.isPending}
                className="py-2 px-6 border border-transparent rounded-full shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {mutation.isPending ? 'Speichere...' : 'Speichern'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
