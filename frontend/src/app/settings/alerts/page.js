'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAlertSettings, updateAlertSettings } from '@/lib/api';
import { useLicense } from '@/lib/license/LicenseContext';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { Skeleton } from '@/components/Skeleton';
import { ContainerAlertSettingsCard } from '@/components/alerts/ContainerAlertSettingsCard';

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
        <div className="bg-card rounded-xl border border-border p-6 max-w-2xl">
          <div className="mb-6">
            <Skeleton className="h-4 w-32 mb-2" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-3 w-64 mt-1" />
          </div>
          <div className="mb-6">
            <Skeleton className="h-5 w-48" />
          </div>
          <div className="space-y-4 pt-6 border-t border-border">
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
          <div className="mt-8 pt-6 border-t border-border flex justify-end">
            <Skeleton className="h-10 w-32 rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader eyebrow="Einstellungen" title="Alerts" description="Konfiguriere E-Mail-Benachrichtigungen für wichtige Ereignisse." />

      <div className="bg-card rounded-xl border border-border p-6 max-w-2xl">
        {showSuccess && (
          <div className="mb-6 bg-primary/5 border border-primary/20 rounded-lg p-4">
            <p className="text-primary font-medium">Einstellungen erfolgreich gespeichert!</p>
          </div>
        )}

        {mutation.isError && (
          <div className="mb-6 bg-danger/5 border border-danger/20 rounded-lg p-4">
            <p className="text-danger font-medium">
              Fehler beim Speichern: {mutation.error?.message}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* E-Mail */}
          <div className="mb-6">
            <label htmlFor="email" className="block text-sm font-medium text-muted mb-2">
              E-Mail-Adresse
            </label>
            <input
              type="email"
              id="email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              className="w-full px-4 py-2 border border-border rounded-lg focus:ring-primary/40 focus:border-primary transition-colors"
              placeholder="alerts@example.com"
              required
            />
            <p className="text-xs text-muted mt-1">
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
              className="h-4 w-4 text-primary focus:ring-primary border-border rounded"
            />
            <label htmlFor="enabled" className="ml-2 block text-sm text-foreground font-medium">
              Benachrichtigungen aktivieren
            </label>
          </div>

          <div className={`space-y-4 border-t border-border pt-6 ${!formData.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
            <h3 className="text-lg font-medium text-foreground">Ereignisse</h3>

            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  type="checkbox"
                  id="notifyOnInstanceOffline"
                  checked={formData.notifyOnInstanceOffline}
                  onChange={(e) => handleChange('notifyOnInstanceOffline', e.target.checked)}
                  disabled={!formData.enabled}
                  className="h-4 w-4 text-primary focus:ring-primary border-border rounded"
                />
              </div>
              <div className="ml-3 text-sm">
                <label htmlFor="notifyOnInstanceOffline" className="font-medium text-muted">
                  Instanz Offline
                </label>
                <p className="text-muted">Benachrichtigung, wenn eine Instanz nicht mehr erreichbar ist</p>
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
                    className={`h-4 w-4 ${!workflowErrorEnabled ? 'text-muted bg-soft cursor-not-allowed' : 'text-primary focus:ring-primary'} border-border rounded`}
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="notifyOnWorkflowError" className={`font-medium text-muted ${!workflowErrorEnabled ? 'cursor-not-allowed' : ''}`}>
                    Workflow Fehler
                  </label>
                  <p className="text-muted">Benachrichtigung bei fehlgeschlagenen Workflow-Ausführungen</p>
                </div>
              </div>
              {!workflowErrorEnabled && (
                <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block w-max px-3 py-1.5 bg-foreground text-background text-xs rounded-md shadow-lg z-50">
                  Nur im Managed Hosting verfügbar (Solo und Agency)
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
                    className={`h-4 w-4 ${!invalidApiKeyEnabled ? 'text-muted bg-soft cursor-not-allowed' : 'text-primary focus:ring-primary'} border-border rounded`}
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="notifyOnInvalidApiKey" className={`font-medium text-muted ${!invalidApiKeyEnabled ? 'cursor-not-allowed' : ''}`}>
                    Ungültiger API Key
                  </label>
                  <p className="text-muted">Benachrichtigung, wenn der API Key einer Instanz abgelehnt wird</p>
                </div>
              </div>
              {!invalidApiKeyEnabled && (
                <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block w-max px-3 py-1.5 bg-foreground text-background text-xs rounded-md shadow-lg z-50">
                  Nur im Managed Hosting verfügbar (Solo und Agency)
                  <div className="absolute top-full left-4 -mt-1 border-4 border-transparent border-t-gray-900"></div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-border flex justify-end">
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
      <ContainerAlertSettingsCard />
    </div>
  );
}
