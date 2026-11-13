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
        className="fixed top-4 right-4 left-4 sm:left-auto sm:max-w-sm z-50 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted shadow-lg"
      >
        Lizenz wird abgerufen...
      </div>
    );
  }

  if (!error || dismissed) return null;

  return (
    <div
      role="alert"
      className="fixed top-4 right-4 left-4 sm:left-auto sm:max-w-sm z-50 flex items-start gap-3 rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger shadow-lg"
    >
      <p>Keine Verbindung zur API möglich. Bitte versuche es später erneut.</p>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Fehlermeldung schließen"
        className="shrink-0 rounded px-1 font-semibold hover:bg-danger/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}
