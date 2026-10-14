'use client';

import { Fragment, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getInstanceDiagnostics } from '@/lib/api';
import type { DiagnosticResult } from '@/lib/types';
import { BUTTON_SECONDARY, CARD, CARD_TITLE, CATEGORY_LABEL, STATUS_BADGE, STATUS_LABEL } from '@/lib/diagnostics/format';
import { formatDate } from '@/lib/utils';

function StatusBadge({ status }: { status: DiagnosticResult['status'] }) {
  return (
    <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full border whitespace-nowrap ${STATUS_BADGE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

/**
 * Generic rendering of GET /instances/{id}/diagnostics. Renders every check
 * and conclusion of the connected edition; checks contributed by Premium need
 * no UI of their own.
 */
export function DiagnosticReportPanel({ externalId }: { externalId: string }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const { data: report, isFetching, error } = useQuery({
    queryKey: ['diagnostics', externalId],
    queryFn: () => getInstanceDiagnostics(externalId),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const grouped = (report?.checks ?? []).reduce<Record<string, DiagnosticResult[]>>((acc, check) => {
    (acc[check.category] ??= []).push(check);
    return acc;
  }, {});

  return (
    <div className={CARD}>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className={`${CARD_TITLE} mb-1`}>Diagnosebericht</h3>
          {report && (
            <p className="text-xs text-gray-500 dark:text-zinc-400">
              Erstellt {formatDate(report.generatedAt)} · {report.checks.length} Prüfungen · {report.durationMs} ms
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {report && <StatusBadge status={report.overallStatus} />}
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['diagnostics', externalId] })}
            disabled={isFetching}
            className={BUTTON_SECONDARY}
          >
            {isFetching ? 'Prüft…' : 'Diagnose ausführen'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded text-sm">
          Der Diagnosebericht konnte nicht erstellt werden: {(error as Error).message}
        </div>
      )}

      {!report && isFetching && <p className="text-sm text-gray-500 dark:text-zinc-400">Prüfungen laufen…</p>}

      {report && report.conclusions.length > 0 && (
        <div className="mb-6 space-y-3">
          {report.conclusions.map((conclusion) => (
            <div
              key={conclusion.id}
              className={`p-4 rounded-lg border ${STATUS_BADGE[conclusion.severity]}`}
            >
              <p className="font-semibold text-sm">{conclusion.title}</p>
              <p className="text-sm mt-1">{conclusion.explanation}</p>
            </div>
          ))}
        </div>
      )}

      {report && (
        <div className="space-y-6">
          {Object.entries(grouped).map(([category, checks]) => (
            <div key={category}>
              <h4 className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-zinc-500 mb-2">
                {CATEGORY_LABEL[category] ?? category}
              </h4>
              <div className="divide-y divide-gray-100 dark:divide-zinc-800 border border-gray-100 dark:border-zinc-800 rounded-lg">
                {checks.map((check) => {
                  const hasDetails = Object.keys(check.details ?? {}).length > 0;
                  const isOpen = !!expanded[check.id];
                  return (
                    <Fragment key={check.id}>
                      <div className="p-3 flex items-start gap-3">
                        <StatusBadge status={check.status} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-zinc-100">{check.title}</p>
                          <p className="text-sm text-gray-700 dark:text-zinc-300">{check.summary}</p>
                          {check.hint && <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">{check.hint}</p>}
                        </div>
                        {hasDetails && (
                          <button
                            onClick={() => setExpanded((prev) => ({ ...prev, [check.id]: !isOpen }))}
                            className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline whitespace-nowrap"
                          >
                            {isOpen ? 'Details ausblenden' : 'Details'}
                          </button>
                        )}
                      </div>
                      {hasDetails && isOpen && (
                        <pre className="mx-3 mb-3 p-3 bg-gray-50 dark:bg-zinc-800 rounded text-xs font-mono overflow-auto text-gray-700 dark:text-zinc-300">
                          {JSON.stringify(check.details, null, 2)}
                        </pre>
                      )}
                    </Fragment>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
