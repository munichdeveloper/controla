'use client';

interface UpdateProgressOverlayProps {
  isVisible: boolean;
  updatePhase?: string | null;
}

export function UpdateProgressOverlay({ isVisible, updatePhase }: UpdateProgressOverlayProps) {
  if (!isVisible) {
    return null;
  }

  const phaseLabels: Record<string, string> = {
    PULLING: 'Docker Image wird heruntergeladen…',
    RESTARTING: 'n8n wird neugestartet…',
    VERIFYING: 'Version wird verifiziert…',
  };

  const phaseText = updatePhase && phaseLabels[updatePhase] ? phaseLabels[updatePhase] : 'Update läuft…';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 rounded-lg">
      <div className="bg-white dark:bg-zinc-900 p-8 rounded-lg shadow-lg text-center">
        <div className="mb-4 flex justify-center">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 border-4 border-gray-200 dark:border-zinc-700 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-transparent border-t-emerald-500 rounded-full animate-spin"></div>
          </div>
        </div>
        <p className="text-lg font-semibold text-gray-900 dark:text-white">{phaseText}</p>
      </div>
    </div>
  );
}

