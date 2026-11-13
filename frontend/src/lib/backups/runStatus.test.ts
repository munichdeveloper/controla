import { describe, expect, it } from 'vitest';
import { backupErrorHint, describeBackupRun } from './runStatus';

const base = { enabled: true, googleDriveFolderId: 'f', intervalHours: 24 };

describe('describeBackupRun', () => {
  it('shows nothing for backends without run results', () => {
    expect(describeBackupRun(base)).toBeNull();
    expect(describeBackupRun(undefined)).toBeNull();
  });

  it('explains a failed run with a hint for the category and keeps the raw message', () => {
    const view = describeBackupRun({
      ...base,
      lastStatus: 'FAILED',
      lastAttemptAt: '2026-11-13T12:00:00Z',
      lastErrorCategory: 'FOLDER_NOT_FOUND',
      lastErrorMessage: 'Folder not found or not accessible: f',
    });
    expect(view?.tone).toBe('error');
    expect(view?.hint).toContain('Folder ID');
    expect(view?.detail).toBe('Folder not found or not accessible: f');
    expect(view?.attemptAt).toBe('2026-11-13T12:00:00Z');
  });

  it('reports a partial run with the failed instances', () => {
    const view = describeBackupRun({
      ...base,
      lastStatus: 'PARTIAL',
      lastErrorCategory: 'EXPORT_FAILED',
      failedInstances: [{ externalId: 'inst_1', name: 'Staging', errorCategory: 'EXPORT_FAILED' }],
    });
    expect(view?.tone).toBe('warning');
    expect(view?.title).toContain('1 Instanz');
    expect(view?.failedInstances).toHaveLength(1);
  });

  it('reports success without a hint', () => {
    const view = describeBackupRun({ ...base, lastStatus: 'SUCCESS' });
    expect(view?.tone).toBe('ok');
    expect(view?.hint).toBeUndefined();
  });
});

describe('backupErrorHint', () => {
  it('falls back to the generic text for unknown categories', () => {
    expect(backupErrorHint('SOMETHING_NEW')).toBe(backupErrorHint('UNKNOWN'));
    expect(backupErrorHint(undefined)).toBeUndefined();
  });
});
