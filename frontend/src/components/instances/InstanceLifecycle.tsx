'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { archiveInstance, deleteInstance, restoreInstance } from '@/lib/api';
import { useLicense } from '@/lib/license/LicenseContext';
import { FEATURES } from '@/lib/license/features';
import type { InstanceSummary } from '@/lib/types';

type Action = 'archive' | 'delete';

export function useSlotClock() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export function LifecycleDialog({ instance, action, pending, error, onClose, onConfirm }: {
  instance: InstanceSummary;
  action: Action;
  pending: boolean;
  error?: string;
  onClose: () => void;
  onConfirm: (deleteExternalData: boolean) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [confirmation, setConfirmation] = useState('');
  const [deleteExternalData, setDeleteExternalData] = useState(false);
  const deleting = action === 'delete';
  const title = deleting ? 'Endgültig löschen' : 'Aus Ansicht entfernen';

  useEffect(() => { dialog.current?.showModal(); }, []);

  return (
    <dialog ref={dialog} aria-label={`${title}: ${instance.name}`} aria-modal="true"
      onCancel={(event) => { event.preventDefault(); if (!pending) onClose(); }}
      className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-foreground shadow-2xl backdrop:bg-black/50">
      <form onSubmit={(event) => { event.preventDefault(); if (!pending && (!deleting || confirmation === instance.name)) onConfirm(deleteExternalData); }}>
        <h2 className={`mb-4 text-xl font-semibold ${deleting ? 'text-danger' : ''}`}>{title}</h2>
        <p className="mb-4">{instance.name}</p>
        {deleting ? <>
          <p>Diese Aktion kann nicht rückgängig gemacht werden. Verloren gehen:</p>
          <ul className="my-3 list-disc pl-5 text-sm">
            <li>Instanzkonfiguration und gespeicherter API-Key</li>
            <li>In Controla gespeicherte instanzbezogene Daten der angeschlossenen Edition</li>
          </ul>
          <p className="mb-3 text-sm text-muted">Die n8n-Instanz und ihre Workflows bleiben bestehen.</p>
          <label className="mb-4 flex items-start gap-2 text-sm">
            <input type="checkbox" checked={deleteExternalData} disabled={pending}
              onChange={(event) => setDeleteExternalData(event.target.checked)} />
            Externe Daten (z. B. Backups) ebenfalls löschen
          </label>
          <label className="block text-sm">Instanznamen zur Bestätigung eingeben
            <input autoComplete="off" value={confirmation} disabled={pending}
              onChange={(event) => setConfirmation(event.target.value)}
              className="mt-1 w-full rounded-lg border border-border p-2" />
          </label>
        </> : <p className="text-sm text-muted">Die Überwachung wird pausiert. Du kannst die Instanz im Archiv wiederherstellen. Der Platz bleibt bis zum Ende der Sperrzeit belegt.</p>}
        {error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" disabled={pending} onClick={onClose} className="rounded-lg border border-border px-4 py-2">Abbrechen</button>
          <button type="submit" disabled={pending || (deleting && confirmation !== instance.name)}
            className={`rounded-lg px-4 py-2 text-on-primary disabled:opacity-50 ${deleting ? 'bg-danger' : 'bg-primary'}`}>
            {pending ? 'Wird gespeichert…' : title}
          </button>
        </div>
      </form>
    </dialog>
  );
}

export function InstanceLifecycleActions({ instance }: { instance: InstanceSummary }) {
  const { isFeatureEnabled } = useLicense();
  const queryClient = useQueryClient();
  const [action, setAction] = useState<Action | null>(null);
  const canArchive = isFeatureEnabled(FEATURES.INSTANCES_ARCHIVE);
  const canDelete = isFeatureEnabled(FEATURES.INSTANCES_DELETE);
  const mutation = useMutation({
    mutationFn: async ({ action: requested, external = false }: { action: Action | 'restore'; external?: boolean }) => {
      if (requested === 'archive' && canArchive) await archiveInstance(instance.id);
      if (requested === 'restore' && canArchive) await restoreInstance(instance.id);
      if (requested === 'delete' && canDelete) await deleteInstance(instance.id, external);
    },
    onSuccess: () => {
      // Remove cached workflows, events and diagnostics of the previous lifecycle state.
      queryClient.removeQueries({ predicate: query => query.queryKey.includes(instance.id) });
      queryClient.invalidateQueries({ queryKey: ['instances'] });
      setAction(null);
    },
  });
  const open = (requested: Action) => { mutation.reset(); setAction(requested); };

  return <div className="inline-flex flex-wrap items-center gap-2" onClick={event => event.stopPropagation()}>
    {!instance.archivedAt && canArchive && <button type="button" disabled={mutation.isPending} onClick={() => open('archive')}
      title="Aus Ansicht entfernen" aria-label="Aus Ansicht entfernen"
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-soft">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-[18px] w-[18px]" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 9v11h16V9M3 4h18v5H3zM9 13h6" />
      </svg>
    </button>}
    {instance.archivedAt && <>
      {canArchive && <button type="button" disabled={mutation.isPending}
        onClick={() => { mutation.reset(); mutation.mutate({ action: 'restore' }); }}
        className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50">Wiederherstellen</button>}
      {canDelete && <button type="button" disabled={mutation.isPending} onClick={() => open('delete')}
        className="rounded-lg px-3 py-2 text-sm text-danger hover:bg-danger/5">Endgültig löschen</button>}
    </>}
    {action && ((action === 'archive' && canArchive) || (action === 'delete' && canDelete)) &&
      <LifecycleDialog instance={instance} action={action} pending={mutation.isPending}
        error={mutation.error?.message} onClose={() => setAction(null)}
        onConfirm={external => mutation.mutate({ action, external })} />}
    {!action && mutation.error && <p role="alert" className="text-sm text-danger">{mutation.error.message}</p>}
  </div>;
}

export function InstanceArchive({ instances }: { instances: InstanceSummary[] }) {
  const { isFeatureEnabled } = useLicense();
  const now = useSlotClock();
  if (!isFeatureEnabled(FEATURES.INSTANCES_ARCHIVE) && !isFeatureEnabled(FEATURES.INSTANCES_DELETE)) return null;
  const archived = instances.filter(instance => instance.archivedAt);
  return <details className="mt-6 rounded-xl border border-border bg-card p-4">
    <summary className="cursor-pointer font-semibold">Archiv ({archived.length})</summary>
    <p className="mt-3 text-sm text-muted">Die Überwachung archivierter Instanzen ist pausiert.</p>
    {archived.length === 0 && <p className="mt-3 text-sm text-muted">Keine archivierten Instanzen.</p>}
    <ul className="mt-3 divide-y divide-border">
      {archived.map(instance => <li key={instance.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
        <div><p className="font-medium">{instance.name}</p><p className="text-sm text-muted">{instance.baseUrl}</p>
          {instance.slotAvailableAt && new Date(instance.slotAvailableAt).getTime() > now &&
            <p className="text-sm text-muted">Platz wieder frei ab {new Date(instance.slotAvailableAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</p>}
        </div>
        <InstanceLifecycleActions instance={instance} />
      </li>)}
    </ul>
  </details>;
}
