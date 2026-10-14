'use client';

import { useState } from 'react';
import { downloadCompanionSupportBundle, saveBlob } from '@/lib/api';
import { BUTTON_SECONDARY } from '@/lib/diagnostics/format';

export function SupportBundleButton({ externalId }: { externalId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const download = async () => {
    setLoading(true);
    setError(null);
    try {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      saveBlob(await downloadCompanionSupportBundle(externalId), `support-bundle-${externalId}-${stamp}.zip`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button onClick={download} disabled={loading} className={BUTTON_SECONDARY}>
        {loading ? 'Bundle wird erstellt…' : 'Support-Bundle herunterladen'}
      </button>
      {error && <span className="text-sm text-red-600 dark:text-red-400">{error}</span>}
    </div>
  );
}
