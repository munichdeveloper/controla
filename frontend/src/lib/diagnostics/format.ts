import type { DiagnosticStatus } from '../types';

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return '–';
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value < 10 && unit > 0 ? 1 : 0)} ${units[unit]}`;
}

export const STATUS_LABEL: Record<DiagnosticStatus, string> = {
  OK: 'OK',
  WARN: 'Warnung',
  FAIL: 'Fehler',
  SKIPPED: 'Übersprungen',
  ERROR: 'Prüfung fehlgeschlagen',
};

export const STATUS_BADGE: Record<DiagnosticStatus, string> = {
  OK: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-900/30',
  WARN: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-900/30',
  FAIL: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-900/30',
  ERROR: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-900/30',
  SKIPPED: 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700',
};

export const CATEGORY_LABEL: Record<string, string> = {
  CONNECTIVITY: 'Verbindung',
  N8N: 'n8n',
  WORKFLOWS: 'Workflows',
  CONTAINER: 'Container',
  HOST: 'Host',
  LOGS: 'Logs',
};

export const CARD = 'bg-white dark:bg-zinc-900 p-6 rounded-lg border border-gray-200 dark:border-zinc-700';
export const CARD_TITLE = 'text-lg font-semibold mb-4 text-gray-900 dark:text-white';
export const BUTTON_SECONDARY =
  'px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed';
export const SELECT =
  'px-2 py-1.5 text-sm border border-gray-300 dark:border-zinc-600 rounded-md dark:bg-zinc-800 dark:text-white focus:outline-none focus:ring-emerald-500 focus:border-emerald-500';
