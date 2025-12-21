'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAlertSettings, updateAlertSettings } from '@/lib/api';
import { useLicense } from '@/lib/license/LicenseContext';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Skeleton } from '@/components/Skeleton';

export default function AlertSettingsPage() {
  const queryClient = useQueryClient();
  const { isFeatureEnabled, loading: licenseLoading } = useLicense();
  const workflowErrorEnabled = isFeatureEnabled('alert.workflow_error');
  const invalidApiKeyEnabled = isFeatureEnabled('alert.invalid_api_key');

  const [formData, setFormData] = useState({
    email: '',
    enabled: false,
    notifyOnInstanceOffline: false,
    notifyOnWorkflowError: false,
    notifyOnInvalidApiKey: false,
  });
  const [showSuccess, setShowSuccess] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['alertSettings'],
    queryFn: getAlertSettings,
  });

  const mutation = useMutation({
    mutationFn: updateAlertSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alertSettings'] });
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    },
  });

  useEffect(() => {
    if (settings) {
      // Map API structure to form state
      const emailChannel = settings.channels?.email;
      setFormData({
        email: emailChannel?.address || '',
        enabled: !!emailChannel,
        notifyOnInstanceOffline: settings.events?.instanceOffline || false,
        notifyOnWorkflowError: settings.events?.workflowError || false,
        notifyOnInvalidApiKey: settings.events?.invalidApiKey || false,
      });
    }
  }, [settings]);

  const handleSubmit = (e) => {
    e.preventDefault();

    // Map form state to API structure
    const payload = {
      events: {
        instanceOffline: formData.notifyOnInstanceOffline,
        workflowError: formData.notifyOnWorkflowError,
        invalidApiKey: formData.notifyOnInvalidApiKey,
      },
      channels: {}
    };

    if (formData.enabled) {
      payload.channels.email = {
        address: formData.email
      };
    }

    mutation.mutate(payload);
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  if (isLoading || licenseLoading) {
    return (
      <div>
        <div className="mb-6">
          <Skeleton className="h-4 w-32 mb-2" />
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="bg-white dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10 shadow-sm p-6 max-w-2xl backdrop-blur-sm">
          <div className="mb-6">
            <Skeleton className="h-4 w-32 mb-2" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-3 w-64 mt-1" />
          </div>
          <div className="mb-6">
            <Skeleton className="h-5 w-48" />
          </div>
          <div className="space-y-4 pt-6 border-t border-gray-200 dark:border-white/10">
            <Skeleton className="h-6 w-32 mb-4" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-start">
                <Skeleton className="h-5 w-5 mr-3" />
                <div>
                  <Skeleton className="h-5 w-40 mb-1" />
                  <Skeleton className="h-4 w-64" />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-white/10 flex justify-end">
            <Skeleton className="h-10 w-32 rounded-full" />
          </div>
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
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Alert-Einstellungen</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Konfigurieren Sie E-Mail-Benachrichtigungen für wichtige Ereignisse
        </p>
      </div>

      <div className="bg-white dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10 shadow-sm p-6 max-w-2xl backdrop-blur-sm">
        {showSuccess && (
          <div className="mb-6 bg-green-50 dark:bg-emerald-900/20 border border-green-200 dark:border-emerald-800 rounded-lg p-4">
            <p className="text-green-800 dark:text-emerald-300 font-medium">Einstellungen erfolgreich gespeichert!</p>
          </div>
        )}

        {mutation.isError && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-800 dark:text-red-300 font-medium">
              Fehler beim Speichern: {mutation.error?.message}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* E-Mail */}
          <div className="mb-6">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">
              E-Mail-Adresse
            </label>
            <input
              type="email"
              id="email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg focus:ring-emerald-500/50 dark:focus:ring-emerald-500/50 focus:border-emerald-500 dark:focus:border-emerald-500 dark:bg-zinc-950 dark:text-zinc-100 transition-colors"
              placeholder="alerts@example.com"
              required
            />
            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
              An diese E-Mail-Adresse werden Benachrichtigungen gesendet
            </p>
          </div>

          {/* Global Enabled */}
          <div className="mb-6 flex items-center">
            <input
              type="checkbox"
              id="enabled"
              checked={formData.enabled}
              onChange={(e) => handleChange('enabled', e.target.checked)}
              className="h-4 w-4 text-emerald-600 dark:text-emerald-500 focus:ring-emerald-500 dark:focus:ring-emerald-500 border-gray-300 dark:border-zinc-700 rounded dark:bg-zinc-800 dark:checked:bg-emerald-500"
            />
            <label htmlFor="enabled" className="ml-2 block text-sm text-gray-900 dark:text-zinc-100 font-medium">
              Benachrichtigungen aktivieren
            </label>
          </div>

          <div className={`space-y-4 border-t border-gray-200 dark:border-white/10 pt-6 ${!formData.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
            <h3 className="text-lg font-medium text-gray-900 dark:text-zinc-100">Ereignisse</h3>

            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  type="checkbox"
                  id="notifyOnInstanceOffline"
                  checked={formData.notifyOnInstanceOffline}
                  onChange={(e) => handleChange('notifyOnInstanceOffline', e.target.checked)}
                  disabled={!formData.enabled}
                  className="h-4 w-4 text-emerald-600 dark:text-emerald-500 focus:ring-emerald-500 dark:focus:ring-emerald-500 border-gray-300 dark:border-zinc-700 rounded dark:bg-zinc-800 dark:checked:bg-emerald-500"
                />
              </div>
              <div className="ml-3 text-sm">
                <label htmlFor="notifyOnInstanceOffline" className="font-medium text-gray-700 dark:text-zinc-300">
                  Instanz Offline
                </label>
                <p className="text-gray-500 dark:text-zinc-400">Benachrichtigung, wenn eine Instanz nicht mehr erreichbar ist</p>
              </div>
            </div>

            <div className="relative group">
              <div className={`flex items-start ${!workflowErrorEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <div className="flex items-center h-5">
                  <input
                    type="checkbox"
                    id="notifyOnWorkflowError"
                    checked={formData.notifyOnWorkflowError}
                    onChange={(e) => handleChange('notifyOnWorkflowError', e.target.checked)}
                    disabled={!formData.enabled || !workflowErrorEnabled}
                    className={`h-4 w-4 ${!workflowErrorEnabled ? 'text-gray-400 bg-gray-100 dark:bg-zinc-800 cursor-not-allowed' : 'text-emerald-600 dark:text-emerald-500 focus:ring-emerald-500 dark:focus:ring-emerald-500 dark:bg-zinc-800 dark:checked:bg-emerald-500'} border-gray-300 dark:border-zinc-700 rounded`}
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="notifyOnWorkflowError" className={`font-medium text-gray-700 dark:text-zinc-300 ${!workflowErrorEnabled ? 'cursor-not-allowed' : ''}`}>
                    Workflow Fehler
                  </label>
                  <p className="text-gray-500 dark:text-zinc-400">Benachrichtigung bei fehlgeschlagenen Workflow-Ausführungen</p>
                </div>
              </div>
              {!workflowErrorEnabled && (
                <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block w-max px-3 py-1.5 bg-gray-900 text-white text-xs rounded-md shadow-lg z-50">
                  Diese Funktion ist nur in der Business Edition verfügbar
                  <div className="absolute top-full left-4 -mt-1 border-4 border-transparent border-t-gray-900"></div>
                </div>
              )}
            </div>

            <div className="relative group">
              <div className={`flex items-start ${!invalidApiKeyEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <div className="flex items-center h-5">
                  <input
                    type="checkbox"
                    id="notifyOnInvalidApiKey"
                    checked={formData.notifyOnInvalidApiKey}
                    onChange={(e) => handleChange('notifyOnInvalidApiKey', e.target.checked)}
                    disabled={!formData.enabled || !invalidApiKeyEnabled}
                    className={`h-4 w-4 ${!invalidApiKeyEnabled ? 'text-gray-400 bg-gray-100 dark:bg-zinc-800 cursor-not-allowed' : 'text-emerald-600 dark:text-emerald-500 focus:ring-emerald-500 dark:focus:ring-emerald-500 dark:bg-zinc-800 dark:checked:bg-emerald-500'} border-gray-300 dark:border-zinc-700 rounded`}
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="notifyOnInvalidApiKey" className={`font-medium text-gray-700 dark:text-zinc-300 ${!invalidApiKeyEnabled ? 'cursor-not-allowed' : ''}`}>
                    Ungültiger API Key
                  </label>
                  <p className="text-gray-500 dark:text-zinc-400">Benachrichtigung, wenn der API Key einer Instanz abgelehnt wird</p>
                </div>
              </div>
              {!invalidApiKeyEnabled && (
                <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block w-max px-3 py-1.5 bg-gray-900 text-white text-xs rounded-md shadow-lg z-50">
                  Diese Funktion ist nur in der Business Edition verfügbar
                  <div className="absolute top-full left-4 -mt-1 border-4 border-transparent border-t-gray-900"></div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-white/10 flex justify-end">
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
  );
}
