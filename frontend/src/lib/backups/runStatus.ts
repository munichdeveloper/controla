import type { BackupSettings, BackupFailedInstance } from '@/lib/types';

export type BackupRunTone = 'ok' | 'warning' | 'error';

export interface BackupRunView {
  tone: BackupRunTone;
  title: string;
  /** What went wrong and what to do, in customer terms. */
  hint?: string;
  /** Raw message from the backend, for support. */
  detail?: string;
  attemptAt?: string;
  failedInstances: BackupFailedInstance[];
}

const CATEGORY_HINTS: Record<string, string> = {
  FOLDER_NOT_FOUND:
    'Der Google-Drive-Ordner wurde nicht gefunden. Prüfe die Folder ID und ob der Ordner für das verbundene Konto freigegeben ist.',
  ACCESS_DENIED:
    'Kein Zugriff auf Google Drive. Der Zugang wurde vermutlich entzogen oder ist abgelaufen. Verbinde Google Drive neu.',
  QUOTA_EXCEEDED:
    'Der Speicherplatz in Google Drive ist voll. Ein Service-Account braucht eine geteilte Ablage (Shared Drive) als Ziel.',
  DRIVE_NOT_CONFIGURED: 'Google Drive ist nicht verbunden. Hinterlege die Zugangsdaten für Google Drive.',
  EXPORT_FAILED: 'Die Workflows konnten nicht aus n8n gelesen werden. Prüfe, ob die Instanz erreichbar ist.',
  UNKNOWN: 'Der Export ist mit einem unbekannten Fehler abgebrochen.',
};

/** Hint for an error category from the backend; unknown values fall back to the generic text. */
export function backupErrorHint(category?: string | null): string | undefined {
  if (!category) return undefined;
  return CATEGORY_HINTS[category] ?? CATEGORY_HINTS.UNKNOWN;
}

/**
 * Describes the most recent scheduled export. Returns null when the backend does not report run results
 * (older Premium versions and the Community Edition), so the page shows nothing new there.
 */
export function describeBackupRun(settings?: BackupSettings | null): BackupRunView | null {
  if (!settings?.lastStatus) return null;
  const failedInstances = settings.failedInstances ?? [];
  const base = {
    attemptAt: settings.lastAttemptAt ?? undefined,
    failedInstances,
  };
  switch (settings.lastStatus) {
    case 'SUCCESS':
      return { ...base, tone: 'ok', title: 'Letzter Export erfolgreich' };
    case 'PARTIAL':
      return {
        ...base,
        tone: 'warning',
        title: `Letzter Export unvollständig: ${failedInstances.length || 'einige'} Instanz(en) fehlgeschlagen`,
        hint: backupErrorHint(settings.lastErrorCategory),
        detail: settings.lastErrorMessage ?? undefined,
      };
    default:
      return {
        ...base,
        tone: 'error',
        title: 'Letzter Export fehlgeschlagen',
        hint: backupErrorHint(settings.lastErrorCategory),
        detail: settings.lastErrorMessage ?? undefined,
      };
  }
}
