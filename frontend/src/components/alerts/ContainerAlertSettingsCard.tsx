'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getContainerAlertSettings, updateContainerAlertSettings } from '@/lib/api';
import type { ContainerAlertSettings } from '@/lib/types';
import { useLicense } from '@/lib/license/LicenseContext';
import { FEATURES } from '@/lib/license/features';

const OPTIONS: Array<{ key: keyof ContainerAlertSettings; label: string; description: string }> = [
  { key: 'containerOom', label: 'Speicher erschöpft (OOM)', description: 'Der n8n-Container wurde wegen Speichermangels beendet.' },
  { key: 'containerCrashLoop', label: 'Neustart-Schleife', description: 'Der Container startet wiederholt neu (mind. 3-mal in 15 Minuten).' },
  { key: 'containerUnhealthy', label: 'Healthcheck fehlgeschlagen', description: 'Der Docker-Healthcheck meldet „unhealthy“.' },
];

/**
 * Alerts for container events detected via the n8n companion (Premium).
 * Rendered only when the backend reports FEATURES.ALERT_CONTAINER_EVENTS.
 * Notifications use the channels configured above.
 */
export function ContainerAlertSettingsCard() {
  const { isFeatureEnabled } = useLicense();
  const enabled = isFeatureEnabled(FEATURES.ALERT_CONTAINER_EVENTS);
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ContainerAlertSettings>({ containerOom: false, containerCrashLoop: false, containerUnhealthy: false });
  const [saved, setSaved] = useState(false);

  const { data } = useQuery({
    queryKey: ['containerAlertSettings'],
    queryFn: getContainerAlertSettings,
    enabled,
  });
  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const mutation = useMutation({
    mutationFn: updateContainerAlertSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['containerAlertSettings'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  if (!enabled) return null;

  return (
    <div className="mt-8 bg-white dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10 shadow-sm p-8">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-zinc-100 mb-1">Container-Ereignisse</h3>
      <p className="text-sm text-gray-500 dark:text-zinc-400 mb-6">
        Erkannt über den n8n Companion der jeweiligen Instanz. Benachrichtigt wird über die oben eingerichteten Kanäle.
      </p>
      <div className="space-y-4">
        {OPTIONS.map((option) => (
          <label key={option.key} className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form[option.key]}
              onChange={(e) => setForm((prev) => ({ ...prev, [option.key]: e.target.checked }))}
              className="mt-1 h-4 w-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
            />
            <span>
              <span className="block text-sm font-medium text-gray-900 dark:text-zinc-100">{option.label}</span>
              <span className="block text-sm text-gray-500 dark:text-zinc-400">{option.description}</span>
            </span>
          </label>
        ))}
      </div>
      {mutation.error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{(mutation.error as Error).message}</p>}
      <div className="mt-6 flex justify-end items-center gap-3">
        {saved && <span className="text-sm text-emerald-600 dark:text-emerald-400">Gespeichert</span>}
        <button
          onClick={() => mutation.mutate(form)}
          disabled={mutation.isPending}
          className="py-2 px-6 rounded-full text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
        >
          {mutation.isPending ? 'Speichere...' : 'Speichern'}
        </button>
      </div>
    </div>
  );
}
