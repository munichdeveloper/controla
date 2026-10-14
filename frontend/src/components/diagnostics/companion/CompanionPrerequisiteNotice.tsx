'use client';

import type { CompanionSectionState } from '@/lib/diagnostics/gating';
import { MIN_DIAGNOSTICS_COMPANION_VERSION } from '@/lib/diagnostics/gating';
import { CARD } from '@/lib/diagnostics/format';

interface Props {
  state: CompanionSectionState;
  companionVersion?: string | null;
  /** Only passed when the Companion tab is rendered, so the link never points nowhere. */
  onOpenCompanionTab?: () => void;
}

const TEXT: Partial<Record<CompanionSectionState, { title: string; body: (version?: string | null) => string }>> = {
  loading: { title: 'Container-Diagnose', body: () => 'Companion-Status wird geladen…' },
  'needs-setup': {
    title: 'Companion einrichten',
    body: () =>
      'Container-Zustand, Logs, Ressourcen und Docker-Ereignisse liefert der n8n Companion auf dem Docker-Host. Für diese Instanz ist noch kein Companion konfiguriert.',
  },
  unreachable: {
    title: 'Companion nicht erreichbar',
    body: () => 'Der konfigurierte Companion antwortet nicht. Prüfe Adresse, API-Key und ob der Companion-Container läuft.',
  },
  'needs-update': {
    title: 'Companion-Update nötig',
    body: (version) =>
      `Der installierte Companion${version ? ` (Version ${version})` : ''} unterstützt diese Diagnose noch nicht. Benötigt wird mindestens Version ${MIN_DIAGNOSTICS_COMPANION_VERSION}.`,
  },
};

/** Explains why companion diagnostics are unavailable – never a control that calls a missing endpoint. */
export function CompanionPrerequisiteNotice({ state, companionVersion, onOpenCompanionTab }: Props) {
  const text = TEXT[state];
  if (!text) return null;
  return (
    <div className={CARD}>
      <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">{text.title}</h3>
      <p className="text-sm text-gray-600 dark:text-zinc-400">{text.body(companionVersion)}</p>
      {onOpenCompanionTab && (state === 'needs-setup' || state === 'unreachable') && (
        <button onClick={onOpenCompanionTab} className="mt-3 text-sm text-emerald-600 dark:text-emerald-400 hover:underline">
          Zum Companion-Tab
        </button>
      )}
    </div>
  );
}
