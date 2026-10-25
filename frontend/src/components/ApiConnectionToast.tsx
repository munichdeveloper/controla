'use client';

import { useState } from 'react';
import { useLicense } from '@/lib/license/LicenseContext';

export function ApiConnectionToast() {
  const { loading, error } = useLicense();
  const [dismissed, setDismissed] = useState(false);

  if (loading) {
    return (
      <div
        role="status"
        className="fixed top-4 right-4 left-4 sm:left-auto sm:max-w-sm z-50 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 text-sm text-gray-700 dark:text-zinc-300 shadow-lg"
      >
        Lizenz wird abgerufen...
      </div>
    );
  }

  if (!error || dismissed) return null;

  return (
    <div
      role="alert"
      className="fixed top-4 right-4 left-4 sm:left-auto sm:max-w-sm z-50 flex items-start gap-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-zinc-900 px-4 py-3 text-sm text-red-700 dark:text-red-400 shadow-lg"
    >
      <p>Keine Verbindung zur API möglich. Bitte versuche es später erneut.</p>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Fehlermeldung schließen"
        className="shrink-0 rounded px-1 font-bold hover:bg-red-100 dark:hover:bg-red-900/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}
