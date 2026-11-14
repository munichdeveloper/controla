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
  OK: 'bg-primary/5 text-primary border-primary/20',
  WARN: 'bg-warning/5 text-warning border-warning/20',
  FAIL: 'bg-danger/5 text-danger border-danger/20',
  ERROR: 'bg-danger/5 text-danger border-danger/20',
  SKIPPED: 'bg-background text-muted border-border',
};

export const CATEGORY_LABEL: Record<string, string> = {
  CONNECTIVITY: 'Verbindung',
  N8N: 'n8n',
  WORKFLOWS: 'Workflows',
  CONTAINER: 'Container',
  HOST: 'Host',
  LOGS: 'Logs',
};

export const CARD = 'bg-card p-6 rounded-xl border border-border';
export const CARD_TITLE = 'text-lg font-semibold mb-4 text-foreground';
export const BUTTON_SECONDARY =
  'px-3 py-1.5 text-sm rounded-md border border-border text-muted hover:bg-background disabled:opacity-50 disabled:cursor-not-allowed';
export const SELECT =
  'px-2 py-1.5 text-sm border border-border rounded-md focus:outline-none focus:ring-primary focus:border-primary';
