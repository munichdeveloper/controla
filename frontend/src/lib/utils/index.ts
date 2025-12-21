// Utility-Funktionen
import { format, formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

/**
 * Formatiert ein ISO-Datum in ein lesbares deutsches Format
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return 'Nie';

  try {
    const date = new Date(dateString);
    return format(date, 'dd.MM.yyyy HH:mm', { locale: de });
  } catch {
    return 'Ungültig';
  }
}

/**
 * Formatiert ein ISO-Datum als "vor X Minuten/Stunden/Tagen"
 */
export function formatRelativeTime(dateString: string | null | undefined): string {
  if (!dateString) return 'Nie';

  try {
    const date = new Date(dateString);
    return formatDistanceToNow(date, { addSuffix: true, locale: de });
  } catch {
    return 'Ungültig';
  }
}

/**
 * Gibt CSS-Klassen für Status-Badge zurück
 */
export function getStatusColor(status: string): string {
  switch (status?.toLowerCase()) {
    case 'online':
      return 'bg-green-100 text-green-800';
    case 'offline':
      return 'bg-red-100 text-red-800';
    case 'locked':
      return 'bg-amber-100 text-amber-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

/**
 * Gibt CSS-Klassen für Severity-Badge zurück
 */
export function getSeverityColor(severity: string): string {
  switch (severity?.toUpperCase()) {
    case 'ERROR':
      return 'bg-red-100 text-red-800';
    case 'WARNING':
      return 'bg-yellow-100 text-yellow-800';
    case 'INFO':
      return 'bg-blue-100 text-blue-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

