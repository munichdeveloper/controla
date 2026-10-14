'use client';

import { DiagnosticReportPanel } from './DiagnosticReportPanel';
import { CompanionDiagnosticsSection } from './companion/CompanionDiagnosticsSection';

interface Props {
  externalId: string;
  /** Passed only when the Companion tab is rendered. */
  onOpenCompanionTab?: () => void;
}

/** Content of the "Diagnose" tab (tab itself is gated by FEATURES.DIAGNOSTICS_REPORT). */
export function DiagnosticsSection({ externalId, onOpenCompanionTab }: Props) {
  return (
    <div className="space-y-8">
      <DiagnosticReportPanel externalId={externalId} />
      <CompanionDiagnosticsSection externalId={externalId} onOpenCompanionTab={onOpenCompanionTab} />
    </div>
  );
}
