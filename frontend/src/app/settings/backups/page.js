'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getBackupSettings, updateBackupSettings, getInstances, getAllLastBackups } from '@/lib/api';
import { FEATURES } from '@/lib/license/features';
import { useLicense } from '@/lib/license/LicenseContext';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { Skeleton } from '@/components/Skeleton';

export default function BackupSettingsPage() {
  const queryClient = useQueryClient();
  const { isFeatureEnabled, loading: licenseLoading } = useLicense();
  const backupsEnabled = isFeatureEnabled(FEATURES.BACKUP_SCHEDULED);

  const [formData, setFormData] = useState({
    enabled: false,
    googleDriveFolderId: '',
    intervalHours: 24,
  });
  const [showSuccess, setShowSuccess] = useState(false);

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['backupSettings'],
    queryFn: getBackupSettings,
    enabled: backupsEnabled,
  });

  const { data: instances } = useQuery({
    queryKey: ['instances'],
    queryFn: getInstances,
    enabled: backupsEnabled,
  });

  const { data: lastBackups } = useQuery({
    queryKey: ['lastBackups'],
    queryFn: getAllLastBackups,
    enabled: backupsEnabled,
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

  if (licenseLoading || (backupsEnabled && settingsLoading)) {
    return (
      <div>
        <div className="mb-6">
          <Skeleton className="h-4 w-32 mb-2" />
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="space-y-6">
          <div className="bg-card rounded-xl border border-border p-6">
            <Skeleton className="h-6 w-32 mb-4" />
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="flex items-center justify-between p-2 border border-border rounded">
                  <div className="flex items-center space-x-3">
                    <Skeleton className="h-2 w-2 rounded-full" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <Skeleton className="h-3 w-24" />
                </div>
              ))}
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border p-6">
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
            <div className="pt-4 mt-6 border-t border-border flex justify-end">
              <Skeleton className="h-10 w-32 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!backupsEnabled) {
    // ... existing non-premium code ...
    return (
      <div>
        <PageHeader eyebrow="Einstellungen" title="Backups" />

        <div className="bg-card rounded-xl border border-border p-8 max-w-2xl text-center">
          <div className="mb-6 flex justify-center">
            <div className="p-4 bg-primary/10 rounded-full">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 text-primary">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
              </svg>
            </div>
          </div>
          <h3 className="text-xl font-semibold text-foreground mb-2">
            Automatische Backups
          </h3>
          <p className="text-muted mb-6">
            Sichere deine Workflows automatisch auf Google Drive. Geplante Workflow-Exporte sind im Agency-Tarif enthalten.
          </p>
          <a
            href="https://www.controla.dev/pricing"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-6 py-3 text-base font-medium text-on-primary bg-primary hover:bg-primary-hover rounded-lg transition-colors "
          >
            Jetzt upgraden
          </a>
        </div>
      </div>
    );
  }


  return (
    <div>
      <PageHeader eyebrow="Einstellungen" title="Backups" description="Konfiguriere automatische Backups deiner Workflows auf Google Drive." />

      <div className="space-y-6">
        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="text-lg font-medium text-foreground mb-4">Backup-Status</h3>

          {!instances || instances.length === 0 ? (
            <p className="text-muted text-sm">Keine Instanzen gefunden.</p>
          ) : (
            <div className="space-y-2">
              {instances.map((instance) => {
                const lastBackup = lastBackups?.[instance.id];
                return (
                  <div key={instance.id} className="flex items-center justify-between p-2 bg-background rounded border border-border">
                    <div className="flex items-center space-x-3 overflow-hidden">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${lastBackup ? 'bg-primary' : 'bg-border'}`}></div>
                      <div className="truncate">
                        <div className="text-sm font-medium text-foreground truncate">{instance.name}</div>
                      </div>
                    </div>
                    <div className="text-right whitespace-nowrap ml-4">
                      <div className={`text-xs ${lastBackup ? 'text-primary' : 'text-muted'}`}>
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

        <div className="bg-card rounded-xl border border-border p-6">
          {showSuccess && (
            <div className="mb-6 bg-primary/5 border border-primary/20 rounded-lg p-4">
              <p className="text-primary font-medium">Einstellungen erfolgreich gespeichert!</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <label htmlFor="enabled" className="text-base font-medium text-foreground">
                  Automatische Backups aktivieren
                </label>
                <p className="text-sm text-muted">
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
                <div className="w-11 h-6 bg-soft peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/40 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-card after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            <div className={`space-y-6 transition-opacity duration-200 ${formData.enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
              <div>
                <label htmlFor="googleDriveFolderId" className="block text-sm font-medium text-muted mb-1">
                  Google Drive Folder ID
                </label>
                <input
                  type="text"
                  id="googleDriveFolderId"
                  value={formData.googleDriveFolderId}
                  onChange={(e) => handleChange('googleDriveFolderId', e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-card text-foreground"
                  placeholder="z.B. 1A2B3C4D5E6F7G8H9I0J"
                  required={formData.enabled}
                />
                <p className="mt-1 text-sm text-muted">
                  Die ID des Ordners in Google Drive, in dem die Backups gespeichert werden sollen.
                </p>
              </div>

              <div>
                <label htmlFor="intervalHours" className="block text-sm font-medium text-muted mb-1">
                  Backup-Intervall (Stunden)
                </label>
                <select
                  id="intervalHours"
                  value={formData.intervalHours}
                  onChange={(e) => handleChange('intervalHours', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-card text-foreground"
                >
                  <option value={1}>Stündlich</option>
                  <option value={24}>Täglich</option>
                  <option value={168}>Wöchentlich</option>
                  <option value={720}>Monatlich</option>
                </select>
              </div>
            </div>

            <div className="pt-4 border-t border-border flex justify-end">
              <button
                type="submit"
                disabled={mutation.isPending}
                className="py-2 px-6 border border-transparent rounded-lg text-sm font-medium text-on-primary bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
