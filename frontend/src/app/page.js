'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getInstances, createInstance, updateInstance, exportInstanceWorkflows } from '@/lib/api';
import { formatRelativeTime, getStatusColor } from '@/lib/utils';
import { useAuth } from '@/lib/auth/AuthContext';
import { useLicense } from '@/lib/license/LicenseContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Skeleton } from '@/components/Skeleton';

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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-white/10 shadow-2xl p-6 max-w-md w-full mx-4 transform transition-all">
        <h3 className="text-xl font-bold text-gray-900 dark:text-zinc-100 mb-4">Neue Instanz hinzufügen</h3>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
              Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/50 dark:focus:ring-emerald-500/50 focus:border-emerald-500 dark:focus:border-emerald-500 dark:bg-zinc-950 dark:text-zinc-100 transition-colors"
              placeholder="Production n8n"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
              Base URL *
            </label>
            <input
              type="url"
              required
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/50 dark:focus:ring-emerald-500/50 focus:border-emerald-500 dark:focus:border-emerald-500 dark:bg-zinc-950 dark:text-zinc-100 transition-colors"
              placeholder="https://n8n.example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
              API Key *
            </label>
            <input
              type="password"
              required
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/50 dark:focus:ring-emerald-500/50 focus:border-emerald-500 dark:focus:border-emerald-500 dark:bg-zinc-950 dark:text-zinc-100 transition-colors"
              placeholder="n8n_api_..."
            />
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-zinc-700 rounded-full text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-4 py-2 bg-emerald-600 text-white rounded-full hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
  if (!version || version === 'unknown' || !latestVersion) return null;

  const isUpToDate = version === latestVersion;

  if (isUpToDate) {
    return (
      <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
        aktuell
      </span>
    );
  }

  return (
    <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
      Update verfügbar: {latestVersion}
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-white/10 shadow-2xl p-6 max-w-md w-full mx-4 transform transition-all">
        <h3 className="text-xl font-bold text-gray-900 dark:text-zinc-100 mb-4">Instanz bearbeiten</h3>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
              Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/50 dark:focus:ring-emerald-500/50 focus:border-emerald-500 dark:focus:border-emerald-500 dark:bg-zinc-950 dark:text-zinc-100 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
              Base URL *
            </label>
            <input
              type="url"
              required
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/50 dark:focus:ring-emerald-500/50 focus:border-emerald-500 dark:focus:border-emerald-500 dark:bg-zinc-950 dark:text-zinc-100 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
              Neuer API Key (optional)
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/50 dark:focus:ring-emerald-500/50 focus:border-emerald-500 dark:focus:border-emerald-500 dark:bg-zinc-950 dark:text-zinc-100 transition-colors"
              placeholder="Leer lassen zum Beibehalten"
            />
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-zinc-700 rounded-full text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full font-medium shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {mutation.isPending ? 'Speichern...' : 'Speichern'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user, logout, isAuthenticated, isLoading: authLoading } = useAuth();
  const { license, maxInstances, isPremium } = useLicense();
  const router = useRouter();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingInstance, setEditingInstance] = useState(null);
  const [exportingId, setExportingId] = useState(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  const { data: instances, isLoading, error } = useQuery({
    queryKey: ['instances'],
    queryFn: getInstances,
    enabled: isAuthenticated,
  });

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
      <div>
        <div className="mb-8 flex justify-between items-center">
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-10 w-40 rounded-full" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10 shadow-sm p-6 h-full backdrop-blur-sm">
              <div className="flex justify-between items-start mb-4">
                <Skeleton className="h-6 w-32" />
                <div className="flex space-x-2">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-8 w-8 rounded-full" />
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <div className="flex justify-between items-center">
                  <Skeleton className="h-4 w-10" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <div className="flex justify-between items-center">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-gray-100 dark:border-white/10 flex justify-end">
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h3 className="text-red-800 font-semibold">Fehler beim Laden</h3>
        <p className="text-red-600 text-sm mt-1">{error.message}</p>
      </div>
    );
  }

  const canAddMore = !instances || maxInstances === -1 || instances.length < maxInstances;
  const hasLockedInstances = instances?.some(i => i.status === 'locked');

  return (
    <div>
      {hasLockedInstances && (
        <div className="mb-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-amber-600 dark:text-amber-400 mr-3">
              <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-amber-800 dark:text-amber-200 font-medium">Einige Instanzen sind gesperrt</p>
              <p className="text-amber-700 dark:text-amber-300 text-sm mt-1">Bitte melden Sie sich erneut an, um den Zugriff wiederherzustellen.</p>
            </div>
          </div>
          <button
            onClick={() => router.push('/login')}
            className="px-4 py-2 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 rounded-full text-sm font-medium hover:bg-amber-200 dark:hover:bg-amber-900/60 transition-colors"
          >
            Zum Login
          </button>
        </div>
      )}

      <div className="mb-8 flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-zinc-100 tracking-tight">Instanz-Übersicht</h2>
          <p className="text-gray-600 dark:text-zinc-400 mt-2">
            {isPremium ? (
              <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-400">
                Business Edition
              </span>
            ) : (
              license?.edition || 'Community Edition'
            )}
            : {maxInstances === -1 ? 'Beliebig viele Instanzen überwachen' : `Bis zu ${maxInstances} n8n-Instanzen überwachen`}
          </p>
        </div>
        {canAddMore && (
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-emerald-600 text-white px-4 py-2 rounded-full hover:bg-emerald-700 font-medium shadow-sm transition-colors"
          >
            + Instanz hinzufügen
          </button>
        )}
      </div>

      {!instances || instances.length === 0 ? (
        <div className="bg-white dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10 shadow-sm p-12 text-center backdrop-blur-sm">
          <p className="text-gray-500 dark:text-zinc-400 mb-6 text-lg">Keine Instanzen gefunden</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-6 py-3 rounded-full hover:bg-emerald-500/20 font-medium shadow-sm transition-colors"
          >
            Erste Instanz hinzufügen
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {instances.map((instance) => (
            <div
              key={instance.id}
              className="block group relative"
            >
              <div className="bg-white dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10 shadow-sm hover:shadow-md dark:hover:bg-white/10 dark:hover:border-white/20 transition-all p-6 h-full backdrop-blur-sm">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-zinc-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                    <Link href={`/instances/${instance.id}`} className="focus:outline-none">
                      <span className="absolute inset-0" aria-hidden="true" />
                      {instance.name}
                    </Link>
                  </h3>
                  <div className="flex items-center space-x-2 relative z-10">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(instance.status)}`}>
                      {instance.status}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingInstance(instance);
                      }}
                      className="p-1.5 text-gray-400 hover:text-emerald-600 dark:text-zinc-500 dark:hover:text-emerald-400 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800"
                      title="Instanz bearbeiten"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => handleExport(e, instance.id)}
                      disabled={exportingId === instance.id}
                      className="p-1.5 text-gray-400 hover:text-emerald-600 dark:text-zinc-500 dark:hover:text-emerald-400 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800"
                      title="Alle Workflows exportieren"
                    >
                      {exportingId === instance.id ? (
                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-3 text-sm text-gray-600 dark:text-zinc-400">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-900 dark:text-zinc-300">Version:</span>
                    <div className="flex items-center">
                      <span className="mr-2">{instance.version}</span>
                      <VersionBadge
                        version={instance.version}
                        latestVersion={instance.latestVersion}
                      />
                    </div>
                  </div>
                  <div className="flex justify-between items-center relative z-10">
                    <span className="font-medium text-gray-900 dark:text-zinc-300">URL:</span>
                    <a
                      href={instance.baseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs truncate max-w-[180px] text-emerald-600 dark:text-emerald-400 hover:underline"
                      title={instance.baseUrl}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {instance.baseUrl}
                    </a>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-900 dark:text-zinc-300">Zuletzt gesehen:</span>
                    <span>{formatRelativeTime(instance.lastSeenAt)}</span>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-gray-100 dark:border-white/10 flex justify-end relative z-10">
                  <Link href={`/instances/${instance.id}`} className="text-sm text-emerald-600 dark:text-emerald-400 font-medium group-hover:translate-x-1 transition-transform inline-flex items-center">
                    Details anzeigen
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 ml-1">
                      <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
                    </svg>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {instances && maxInstances !== -1 && instances.length < maxInstances && instances.length > 0 && (
        <div className="mt-8 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-xl p-4 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mr-3">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
          </svg>
          <p className="text-emerald-800 dark:text-emerald-300 text-sm font-medium">
            Sie können noch {maxInstances - instances.length} weitere Instanz(en) hinzufügen.
          </p>
        </div>
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
