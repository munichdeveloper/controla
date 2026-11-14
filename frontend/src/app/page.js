'use client';

import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import { getInstances, createInstance, updateInstance, exportInstanceWorkflows, getInstanceErrorPatterns, getInstanceEvents } from '@/lib/api';
import { summarizeErrorPatterns, formatErrorCount, pickLatestError } from '@/lib/dashboard/errorSummary';
import { formatRelativeTime, getVersionUpdateState } from '@/lib/utils';
import { useAuth } from '@/lib/auth/AuthContext';
import { useLicense } from '@/lib/license/LicenseContext';
import { editionLabel } from '@/lib/license/edition';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Skeleton } from '@/components/Skeleton';
import { FEATURES } from '@/lib/license/features';
import { InstanceArchive, InstanceLifecycleActions, useSlotClock } from '@/components/instances/InstanceLifecycle';

function AddInstanceModal({ isOpen, onClose, onSuccess }) {
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: createInstance,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instances'] });
      onSuccess();
      onClose();
      setName('');
      setBaseUrl('');
      setApiKey('');
      setError('');
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    mutation.mutate({ name, baseUrl, apiKey });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card rounded-xl border border-border shadow-2xl p-6 max-w-md w-full mx-4 transform transition-all">
        <h3 className="text-xl font-semibold text-foreground mb-4">Neue Instanz hinzufügen</h3>

        {error && (
          <div className="bg-danger/5 border border-danger/20 text-danger px-4 py-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted mb-1">
              Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
              placeholder="Production n8n"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted mb-1">
              Base URL *
            </label>
            <input
              type="url"
              required
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
              placeholder="https://n8n.example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted mb-1">
              API Key *
            </label>
            <input
              type="password"
              required
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
              placeholder="n8n_api_..."
            />
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-border rounded-lg text-muted hover:bg-background transition-colors"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-4 py-2 bg-primary text-on-primary rounded-lg hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {mutation.isPending ? 'Speichern...' : 'Hinzufügen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function VersionBadge({ version, latestVersion }) {
  const updateState = getVersionUpdateState(version, latestVersion);

  if (updateState !== 'update-available') {
    return null;
  }

  return (
    <span className="ml-2 inline-flex shrink-0 whitespace-nowrap rounded-full border border-warning/30 px-2 py-0.5 text-[11px] font-medium text-warning">
      Update {latestVersion}
    </span>
  );
}

const STATUS_LABELS = {
  online: { label: 'Online', tone: 'text-primary', dot: 'bg-primary' },
  offline: { label: 'Nicht erreichbar', tone: 'text-danger', dot: 'bg-danger' },
  locked: { label: 'Gesperrt', tone: 'text-warning', dot: 'bg-warning' },
};

function StatusLabel({ status }) {
  const s = STATUS_LABELS[status] || { label: 'Unbekannt', tone: 'text-muted', dot: 'bg-muted' };
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${s.tone}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden="true" />
      {s.label}
    </span>
  );
}

function EditInstanceModal({ isOpen, onClose, onSuccess, instance }) {
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');
  const queryClient = useQueryClient();

  useEffect(() => {
    if (instance) {
      setName(instance.name);
      setBaseUrl(instance.baseUrl);
      setApiKey(''); // API Key is not returned for security, user sets new one if needed
    }
  }, [instance]);

  const mutation = useMutation({
    mutationFn: (data) => updateInstance(instance.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instances'] });
      onSuccess();
      onClose();
      setError('');
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    const data = { name, baseUrl };
    if (apiKey) {
      data.apiKey = apiKey;
    }
    mutation.mutate(data);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card rounded-xl border border-border shadow-2xl p-6 max-w-md w-full mx-4 transform transition-all">
        <h3 className="text-xl font-semibold text-foreground mb-4">Instanz bearbeiten</h3>

        {error && (
          <div className="bg-danger/5 border border-danger/20 text-danger px-4 py-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted mb-1">
              Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted mb-1">
              Base URL *
            </label>
            <input
              type="url"
              required
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted mb-1">
              Neuer API Key (optional)
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
              placeholder="Leer lassen zum Beibehalten"
            />
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-border rounded-lg text-muted hover:bg-background transition-colors"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-4 py-2 bg-primary hover:bg-primary-hover text-on-primary rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {mutation.isPending ? 'Speichern...' : 'Speichern'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function LatestErrorPanel({ latestError, event, loading }) {
  return (
    <aside className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <p className="font-mono text-[10px] uppercase tracking-wide text-muted">
        Letzter Fehler{latestError ? ` · ${latestError.instance.name}` : ''}
      </p>
      {loading && !latestError ? (
        <div className="mt-5 space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : !latestError ? (
        <p className="mt-5 text-sm text-muted">Keine fehlgeschlagenen Ausführungen in den letzten 24 Stunden.</p>
      ) : (
        <>
          <h3 className="mt-5 text-lg font-semibold text-foreground">
            {event?.payload?.workflowName || latestError.latest.workflows[0] || 'Unbekannter Workflow'}
          </h3>
          <p className="mt-2 text-xs text-muted">
            {event?.payload?.node ? `Node: ${event.payload.node} · ` : ''}
            {formatRelativeTime(event?.occurredAt || latestError.latest.occurredAt)}
          </p>
          <div className="mt-4 rounded-lg border border-danger/20 bg-danger/5 p-4">
            <p className="break-words font-mono text-xs text-danger">
              {event?.payload?.errorMessage || latestError.latest.errorMessage}
            </p>
          </div>
          <Link
            href={`/instances/${latestError.instance.id}`}
            className="mt-5 inline-flex text-sm font-medium text-primary hover:underline"
          >
            Instanz öffnen →
          </Link>
        </>
      )}
    </aside>
  );
}

export default function Dashboard() {
  const { user, logout, isAuthenticated, isLoading: authLoading } = useAuth();
  const { license, maxInstances, isPremium, loading: licenseLoading, error: licenseError, isFeatureEnabled } = useLicense();
  const router = useRouter();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingInstance, setEditingInstance] = useState(null);
  const [exportingId, setExportingId] = useState(null);
  const now = useSlotClock();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  const includeArchived = isFeatureEnabled(FEATURES.INSTANCES_ARCHIVE) || isFeatureEnabled(FEATURES.INSTANCES_DELETE);
  const { data: allInstances, isLoading, error } = useQuery({
    queryKey: ['instances', { includeArchived }],
    queryFn: () => getInstances(includeArchived),
    enabled: isAuthenticated,
  });

  const instances = allInstances?.filter(instance => !instance.archivedAt);

  // Errors of the last 24 h per reachable instance, from the existing
  // error-pattern endpoint (CE and Premium). Offline/locked instances stay unknown.
  const reachable = (instances || []).filter((i) => i.status === 'online');
  const errorQueries = useQueries({
    queries: reachable.map((instance) => ({
      queryKey: ['error-patterns', instance.id, '1d'],
      queryFn: () => getInstanceErrorPatterns(instance.id, '1d'),
      staleTime: 2 * 60 * 1000,
      retry: false,
    })),
  });
  const errorSummaries = {};
  reachable.forEach((instance, index) => {
    errorSummaries[instance.id] = summarizeErrorPatterns(errorQueries[index]?.data);
  });
  const errorsLoading = errorQueries.some((q) => q.isLoading);
  const latestError = pickLatestError(reachable, errorSummaries);

  // Node and workflow of that newest error (one event, same endpoint as the Fehler tab).
  const { data: latestEvents } = useQuery({
    queryKey: ['events', latestError?.instance.id, 'latest'],
    queryFn: () => getInstanceEvents(latestError.instance.id, { type: 'WORKFLOW_ERROR', limit: 1 }),
    enabled: !!latestError,
    staleTime: 2 * 60 * 1000,
    retry: false,
  });
  const latestEvent = latestEvents?.[0];

  const handleExport = async (e, instanceId) => {
    e.preventDefault();
    e.stopPropagation();
    setExportingId(instanceId);
    try {
      const blob = await exportInstanceWorkflows(instanceId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `workflows-${instanceId}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error(err);
      alert('Export fehlgeschlagen');
    } finally {
      setExportingId(null);
    }
  };

  if (authLoading || !isAuthenticated || isLoading) {
    return (
      <div aria-busy="true">
        <Skeleton className="h-3 w-40 mb-4" />
        <Skeleton className="h-9 w-72 mb-3" />
        <Skeleton className="h-4 w-96 mb-10" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4">
              <Skeleton className="h-3 w-20 mb-4" />
              <Skeleton className="h-8 w-10" />
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-danger/5 border border-danger/20 rounded-xl p-4">
        <h3 className="text-danger font-semibold">Fehler beim Laden</h3>
        <p className="text-muted text-sm mt-1">{error.message}</p>
      </div>
    );
  }

  // Without a loaded license the limit is unknown, not zero: keep creation disabled and say why.
  const licenseKnown = !!license;
  const occupiedSlots = (allInstances || []).filter(instance => !instance.archivedAt ||
    (instance.slotAvailableAt && new Date(instance.slotAvailableAt).getTime() > now)).length;
  const canAddMore = licenseKnown && (maxInstances === -1 || occupiedSlots < maxInstances);
  const hasLockedInstances = instances?.some(i => i.status === 'locked');
  const list = instances || [];
  const onlineCount = list.filter((i) => i.status === 'online').length;
  const offlineCount = list.filter((i) => i.status === 'offline').length;
  const updateCount = list.filter((i) => getVersionUpdateState(i.version, i.latestVersion) === 'update-available').length;
  const knownErrorCounts = Object.values(errorSummaries).filter((e) => e.count !== null);
  const errorTotal = knownErrorCounts.reduce((sum, e) => sum + e.count, 0);
  const errorCapped = knownErrorCounts.some((e) => e.capped);
  const stats = [
    { label: 'Instanzen', value: list.length, tone: '' },
    {
      label: 'Erreichbar',
      value: onlineCount,
      tone: 'text-primary',
      hint: offlineCount > 0 ? `${offlineCount} nicht erreichbar` : null,
    },
    {
      label: 'Fehler 24 h',
      value: errorsLoading && knownErrorCounts.length === 0 ? '…' : `${errorTotal}${errorCapped ? '+' : ''}`,
      tone: errorTotal > 0 ? 'text-warning' : '',
    },
    { label: 'Updates verfügbar', value: updateCount, tone: '' },
  ];

  const editButton = (instance) => (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setEditingInstance(instance);
      }}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-soft hover:text-primary"
      title="Instanz bearbeiten"
      aria-label={`${instance.name} bearbeiten`}
    >
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-[18px] h-[18px]" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
      </svg>
    </button>
  );

  const exportButton = (instance) => (
    <button
      type="button"
      onClick={(e) => handleExport(e, instance.id)}
      disabled={exportingId === instance.id}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-soft hover:text-primary disabled:opacity-50"
      title="Alle Workflows exportieren"
      aria-label={`Workflows von ${instance.name} exportieren`}
    >
      {exportingId === instance.id ? (
        <svg className="animate-spin h-[18px] w-[18px]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-[18px] h-[18px]" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
      )}
    </button>
  );

  return (
    <div>
      {hasLockedInstances && (
        <div className="mb-6 bg-warning/5 border border-warning/20 rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-warning mr-3 shrink-0" aria-hidden="true">
              <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-foreground font-medium">Einige Instanzen sind gesperrt</p>
              <p className="text-muted text-sm mt-1">Bitte melde dich erneut an, um den Zugriff wiederherzustellen.</p>
            </div>
          </div>
          <button
            onClick={() => router.push('/login')}
            className="px-4 py-2 border border-warning/30 text-warning rounded-lg text-sm font-medium hover:bg-warning/10 transition-colors"
          >
            Zum Login
          </button>
        </div>
      )}

      <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-primary">
            {editionLabel(license, isPremium)}
          </p>
          <h1 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">Instanzübersicht</h1>
          <p className="text-muted mt-2">
            {!licenseKnown
              ? (licenseLoading ? 'Lizenz wird geladen …' : licenseError ? 'Lizenz konnte nicht geladen werden. Bitte Seite neu laden.' : 'Lizenz nicht verfügbar.')
              : maxInstances === -1 ? 'Beliebig viele n8n-Instanzen überwachen.' : `Bis zu ${maxInstances} n8n-Instanzen überwachen.`}
          </p>
        </div>
        {canAddMore && (
          <button
            onClick={() => setShowAddModal(true)}
            className="rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover"
          >
            + Instanz hinzufügen
          </button>
        )}
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-muted">Noch leer</p>
          <h2 className="mt-3 text-2xl font-semibold text-foreground">Keine Instanzen verbunden</h2>
          <p className="mx-auto mt-2 max-w-md text-muted">
            Verbinde deine erste n8n-Instanz über ihre URL und einen API-Key. Controla prüft danach Status, Version und Workflows.
          </p>
          {canAddMore && (
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-6 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover"
            >
              Erste Instanz hinzufügen
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-xl border border-border bg-card p-4">
                <p className="font-mono text-[10px] uppercase tracking-wide text-muted sm:text-xs">{stat.label}</p>
                <p className={`mt-2 font-display text-3xl font-semibold ${stat.tone || 'text-foreground'}`}>{stat.value}</p>
                {stat.hint && <p className="mt-1 text-xs text-danger">{stat.hint}</p>}
              </div>
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 overflow-x-auto rounded-2xl border border-border bg-card shadow-panel">
            <table className="hidden w-full text-left text-sm md:table">
              <caption className="sr-only">Verbundene n8n-Instanzen</caption>
              <thead className="border-b border-border bg-background font-mono text-[10px] uppercase tracking-wide text-muted">
                <tr>
                  {['Instanz', 'Status', 'n8n', 'Letzter Kontakt', 'Fehler 24 h'].map((label) => (
                    <th key={label} scope="col" className="whitespace-nowrap px-4 py-3 font-normal">{label}</th>
                  ))}
                  <th scope="col" className="px-4 py-3 font-normal text-right"><span className="sr-only">Aktionen</span></th>
                </tr>
              </thead>
              <tbody>
                {list.map((instance) => {
                  const offline = instance.status === 'offline';
                  return (
                    <tr
                      key={instance.id}
                      onClick={() => router.push(`/instances/${instance.id}`)}
                      className={`cursor-pointer border-b border-border last:border-0 transition-colors hover:bg-background ${offline ? 'bg-danger/5' : ''}`}
                    >
                      <th scope="row" className="w-full min-w-[12rem] max-w-0 px-4 py-4 font-medium">
                        <Link
                          href={`/instances/${instance.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="block truncate text-foreground hover:text-primary"
                          title={instance.name}
                        >
                          {instance.name}
                        </Link>
                        <span className="mt-0.5 block truncate font-mono text-xs font-normal text-muted" title={instance.baseUrl}>
                          {instance.baseUrl.replace(/^https?:\/\//, '')}
                        </span>
                      </th>
                      <td className="whitespace-nowrap px-4 py-4">
                        <StatusLabel status={instance.status} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-4">
                        <span className="font-mono text-xs text-muted">{instance.version || '–'}</span>
                        <VersionBadge version={instance.version} latestVersion={instance.latestVersion} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-xs text-muted">{formatRelativeTime(instance.lastSeenAt)}</td>
                      <td className={`whitespace-nowrap px-4 py-4 font-mono text-xs ${errorSummaries[instance.id]?.count ? 'text-warning' : 'text-muted'}`}>
                        {formatErrorCount(errorSummaries[instance.id])}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-right">
                        <div className="inline-flex items-center gap-1">
                          {editButton(instance)}
                          {exportButton(instance)}
                          <InstanceLifecycleActions instance={instance} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <ul className="divide-y divide-border md:hidden">
              {list.map((instance) => (
                <li key={instance.id} className={`flex items-start justify-between gap-3 p-4 ${instance.status === 'offline' ? 'bg-danger/5' : ''}`}>
                  <div className="min-w-0">
                    <Link href={`/instances/${instance.id}`} className="font-medium text-foreground hover:text-primary">
                      {instance.name}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      <StatusLabel status={instance.status} />
                      <span className="font-mono text-muted">n8n {instance.version || '–'}</span>
                      <span className="text-muted">{formatRelativeTime(instance.lastSeenAt)}</span>
                      <span className="text-muted">Fehler 24 h: {formatErrorCount(errorSummaries[instance.id])}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center">
                    {editButton(instance)}
                    {exportButton(instance)}
                    <InstanceLifecycleActions instance={instance} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <LatestErrorPanel latestError={latestError} event={latestEvent} loading={errorsLoading} />
          </div>
        </>
      )}

      <InstanceArchive instances={allInstances || []} />

      {instances && maxInstances !== -1 && occupiedSlots < maxInstances && instances.length > 0 && (
        <p className="mt-4 text-sm text-muted">
          Du kannst noch {maxInstances - occupiedSlots} weitere Instanz(en) hinzufügen.
        </p>
      )}

      <AddInstanceModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => {
          // Erfolgsbenachrichtigung könnte hier angezeigt werden
        }}
      />
      {editingInstance && (
        <EditInstanceModal
          isOpen={Boolean(editingInstance)}
          onClose={() => setEditingInstance(null)}
          onSuccess={() => {
            // Erfolgsbenachrichtigung könnte hier angezeigt werden
            setEditingInstance(null);
          }}
          instance={editingInstance}
        />
      )}
    </div>
  );
}
