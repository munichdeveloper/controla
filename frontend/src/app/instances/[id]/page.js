'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getInstance, getInstanceWorkflows, getInstanceEvents, getInstanceErrorPatterns, exportInstanceWorkflows, getInstanceLastBackup, importWorkflow } from '@/lib/api';
import { formatDate, formatRelativeTime, getStatusColor, getSeverityColor } from '@/lib/utils';
import { useState, useMemo, Fragment, useRef } from 'react';
import Link from 'next/link';
import { useLicense } from '@/lib/license/LicenseContext';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { Skeleton } from '@/components/Skeleton';

function VersionBadge({ version, latestVersion }) {
  if (!version || version === 'unknown' || !latestVersion) return null;

  const isUpToDate = version === latestVersion;

  if (isUpToDate) {
    return (
      <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
        (aktuell)
      </span>
    );
  }

  return (
    <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
      Update verfügbar: {latestVersion}
    </span>
  );
}

function LockedState() {
  return (
    <div className="p-12 text-center">
      <div className="inline-flex items-center justify-center p-4 bg-amber-50 dark:bg-amber-900/20 rounded-full mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-8 h-8 text-amber-600 dark:text-amber-400">
          <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
        </svg>
      </div>
      <h3 className="text-lg font-medium text-gray-900 dark:text-zinc-100 mb-2">Instanz ist gesperrt</h3>
      <p className="text-gray-500 dark:text-zinc-400 max-w-md mx-auto">
        Daten können nicht angezeigt werden, da der API Key nicht entschlüsselt werden konnte. Bitte melden Sie sich erneut an.
      </p>
    </div>
  );
}

export default function InstanceDetailPage({ params }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [patternRange, setPatternRange] = useState('14d');
  const [workflowFilter, setWorkflowFilter] = useState('active'); // 'active', 'inactive', 'all'
  const [selectedWorkflows, setSelectedWorkflows] = useState([]);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const instanceId = params.id;
  const { isPremium } = useLicense();
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);

  const { data: instance, isLoading: instanceLoading } = useQuery({
    queryKey: ['instance', instanceId],
    queryFn: () => getInstance(instanceId),
  });

  const { data: lastBackupData } = useQuery({
    queryKey: ['instanceBackup', instanceId],
    queryFn: () => getInstanceLastBackup(instanceId),
    enabled: isPremium && !!instanceId,
  });

  const { data: workflows, isLoading: workflowsLoading } = useQuery({
    queryKey: ['workflows', instanceId],
    queryFn: () => getInstanceWorkflows(instanceId),
    enabled: activeTab === 'workflows',
  });

  const filteredWorkflows = workflows?.filter(wf => {
    if (workflowFilter === 'all') return true;
    if (workflowFilter === 'active') return wf.active;
    if (workflowFilter === 'inactive') return !wf.active;
    return true;
  });

  const groupedWorkflows = useMemo(() => {
    if (!filteredWorkflows) return {};
    const groups = {};
    filteredWorkflows.forEach(wf => {
      const firstChar = wf.name ? wf.name.charAt(0).toUpperCase() : '#';
      const key = /^[A-Z]/.test(firstChar) ? firstChar : '#';
      if (!groups[key]) groups[key] = [];
      groups[key].push(wf);
    });
    // Sort keys
    return Object.keys(groups).sort().reduce((acc, key) => {
      acc[key] = groups[key];
      return acc;
    }, {});
  }, [filteredWorkflows]);

  const toggleGroup = (groupKey) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupKey]: !prev[groupKey]
    }));
  };

  const handleSelectAll = (e) => {
    if (e.target.checked && filteredWorkflows) {
      setSelectedWorkflows(filteredWorkflows.map(wf => wf.id));
    } else {
      setSelectedWorkflows([]);
    }
  };

  const handleSelectWorkflow = (id) => {
    setSelectedWorkflows(prev => {
      if (prev.includes(id)) {
        return prev.filter(wfId => wfId !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleExportSelected = async () => {
    if (selectedWorkflows.length === 0) return;
    setIsExporting(true);
    try {
      const blob = await exportInstanceWorkflows(instanceId, selectedWorkflows);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `workflows-${instanceId}-selected.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setSelectedWorkflows([]);
    } catch (err) {
      console.error(err);
      alert('Export fehlgeschlagen');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      await importWorkflow(instanceId, json);
      alert('Workflow erfolgreich importiert');
      queryClient.invalidateQueries(['workflows', instanceId]);
    } catch (err) {
      console.error(err);
      alert('Import fehlgeschlagen: ' + err.message);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const { data: events, isLoading: eventsLoading } = useQuery({
    queryKey: ['events', instanceId],
    queryFn: () => getInstanceEvents(instanceId, { type: 'WORKFLOW_ERROR', limit: 50 }),
    enabled: activeTab === 'errors',
  });

  const { data: patterns, isLoading: patternsLoading } = useQuery({
    queryKey: ['patterns', instanceId, patternRange],
    queryFn: () => getInstanceErrorPatterns(instanceId, patternRange),
    enabled: activeTab === 'patterns',
  });

  if (instanceLoading) {
    return (
      <div>
        <div className="mb-8">
          <Skeleton className="h-4 w-32 mb-4" />
          <div className="flex justify-between items-start">
            <div>
              <Skeleton className="h-8 w-64 mb-2" />
              <Skeleton className="h-4 w-48" />
            </div>
            <Skeleton className="h-8 w-24 rounded-full" />
          </div>
        </div>
        <div className="border-b border-gray-200 dark:border-white/10 mb-8">
          <div className="flex space-x-8">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-10 w-24" />
            ))}
          </div>
        </div>
        <div className="bg-white dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10 shadow-sm p-8 backdrop-blur-sm">
          <Skeleton className="h-6 w-48 mb-6" />
          <div className="grid grid-cols-2 gap-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i}>
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-6 w-48" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!instance) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h3 className="text-red-800 font-semibold">Instanz nicht gefunden</h3>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <Link href="/" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-emerald-400 text-sm mb-4 inline-flex items-center font-medium transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 mr-1">
            <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
          </svg>
          Zurück zur Übersicht
        </Link>
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-zinc-100 tracking-tight">{instance.name}</h2>
            <p className="text-gray-600 dark:text-zinc-400 text-sm mt-1 font-mono">{instance.baseUrl}</p>
          </div>
          <span className={`px-4 py-1.5 rounded-full text-sm font-medium border ${getStatusColor(instance.status)}`}>
            {instance.status}
          </span>
        </div>
      </div>

      {instance.status === 'locked' && (
        <div className="mb-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-amber-600 dark:text-amber-400 mr-3">
            <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
          </svg>
          <div>
            <p className="text-amber-800 dark:text-amber-200 font-medium">Instanz ist gesperrt</p>
            <p className="text-amber-700 dark:text-amber-300 text-sm">
              Der API Key konnte nicht entschlüsselt werden. Bitte melden Sie sich erneut an, um den Zugriff wiederherzustellen.
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-white/10 mb-8">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'overview'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 dark:border-emerald-400'
                : 'border-transparent text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 hover:border-gray-300 dark:hover:border-zinc-700'
            }`}
          >
            Übersicht
          </button>
          <button
            onClick={() => setActiveTab('workflows')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'workflows'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 dark:border-emerald-400'
                : 'border-transparent text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 hover:border-gray-300 dark:hover:border-zinc-700'
            }`}
          >
            Workflows
          </button>
          <button
            onClick={() => setActiveTab('errors')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'errors'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 dark:border-emerald-400'
                : 'border-transparent text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 hover:border-gray-300 dark:hover:border-zinc-700'
            }`}
          >
            Fehler
          </button>
          <button
            onClick={() => setActiveTab('patterns')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'patterns'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 dark:border-emerald-400'
                : 'border-transparent text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 hover:border-gray-300 dark:hover:border-zinc-700'
            }`}
          >
            Fehlermuster
          </button>
        </nav>
      </div>

      {/* Content */}
      {activeTab === 'overview' && (
        <div className="bg-white dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10 shadow-sm p-8 backdrop-blur-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-zinc-100 mb-6">Basis-Informationen</h3>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <span className="text-sm text-gray-500 dark:text-zinc-500 uppercase tracking-wider font-medium">Version</span>
              <div className="flex items-center mt-1">
                <p className="text-gray-900 dark:text-zinc-100 font-medium text-lg">{instance.version}</p>
                <VersionBadge
                  version={instance.version}
                  latestVersion={instance.latestVersion}
                />
              </div>
            </div>
            <div>
              <span className="text-sm text-gray-500 dark:text-zinc-500 uppercase tracking-wider font-medium">Status</span>
              <div className="mt-1">
                <span className={`px-2.5 py-0.5 rounded-full text-sm font-medium border ${getStatusColor(instance.status)} capitalize`}>
                  {instance.status}
                </span>
              </div>
            </div>
            <div>
              <span className="text-sm text-gray-500 dark:text-zinc-500 uppercase tracking-wider font-medium">URL</span>
              <a
                href={instance.baseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-600 dark:text-emerald-400 font-medium text-lg mt-1 hover:underline block truncate"
              >
                {instance.baseUrl}
              </a>
            </div>
            <div>
              <span className="text-sm text-gray-500 dark:text-zinc-500 uppercase tracking-wider font-medium">Zuletzt gesehen</span>
              <p className="text-gray-900 dark:text-zinc-100 font-medium text-lg mt-1">{formatRelativeTime(instance.lastSeenAt)}</p>
              <p className="text-xs text-gray-500 dark:text-zinc-500 mt-0.5">{formatDate(instance.lastSeenAt)}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500 dark:text-zinc-500 uppercase tracking-wider font-medium">Erstellt am</span>
              <p className="text-gray-900 dark:text-zinc-100 font-medium text-lg mt-1">{formatDate(instance.createdAt)}</p>
            </div>
            {isPremium && (
              <div>
                <span className="text-sm text-gray-500 dark:text-zinc-500 uppercase tracking-wider font-medium">Letztes Backup</span>
                <p className="text-gray-900 dark:text-zinc-100 font-medium text-lg mt-1">
                  {lastBackupData?.lastBackupAt ? (
                    formatDistanceToNow(new Date(lastBackupData.lastBackupAt), { addSuffix: true, locale: de })
                  ) : (
                    'Nie'
                  )}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'workflows' && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-zinc-800 flex justify-between items-center bg-gray-50/50 dark:bg-zinc-900/50">
            <div className="flex items-center space-x-3">
              <h3 className="text-lg font-medium text-gray-900 dark:text-zinc-100">Workflows</h3>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".json"
                className="hidden"
              />
              {isPremium && (
                <button
                  onClick={handleImportClick}
                  disabled={isImporting}
                  title="Workflow importieren"
                  className="p-1.5 rounded-md text-gray-400 hover:text-emerald-600 dark:text-zinc-500 dark:hover:text-emerald-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isImporting ? (
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                  )}
                </button>
              )}
            </div>
            <div className="flex items-center space-x-4">
              {selectedWorkflows.length > 0 && (
                <button
                  onClick={handleExportSelected}
                  disabled={isExporting}
                  className="bg-emerald-600 text-white px-3 py-1.5 text-xs font-medium rounded-full hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center shadow-sm transition-colors"
                >
                  {isExporting ? 'Exportiere...' : `Exportieren (${selectedWorkflows.length})`}
                </button>
              )}
              <div className="flex space-x-2">
                <button
                  onClick={() => setWorkflowFilter('active')}
                  className={`px-3 py-1 text-xs font-medium rounded-full transition-all ${
                    workflowFilter === 'active'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                      : 'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  Aktiv
                </button>
                <button
                  onClick={() => setWorkflowFilter('inactive')}
                  className={`px-3 py-1 text-xs font-medium rounded-full transition-all ${
                    workflowFilter === 'inactive'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                      : 'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  Inaktiv
                </button>
                <button
                  onClick={() => setWorkflowFilter('all')}
                  className={`px-3 py-1 text-xs font-medium rounded-full transition-all ${
                    workflowFilter === 'all'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                      : 'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  Alle
                </button>
              </div>
            </div>
          </div>

          {workflowsLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-4 w-4" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-48 mb-1" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </div>
          ) : instance.status === 'locked' ? (
            <LockedState />
          ) : !filteredWorkflows || filteredWorkflows.length === 0 ? (
            <div className="p-12 text-center text-gray-500 dark:text-zinc-500">Keine Workflows gefunden</div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-800">
              <thead className="bg-gray-50 dark:bg-zinc-950/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-500 uppercase tracking-wider w-10">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 dark:border-zinc-700 text-blue-600 dark:text-emerald-600 focus:ring-blue-500 dark:focus:ring-emerald-500 dark:bg-zinc-800 dark:checked:bg-emerald-600"
                      checked={filteredWorkflows.length > 0 && selectedWorkflows.length === filteredWorkflows.length}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-500 uppercase tracking-wider">
                    Letzter Lauf
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-500 uppercase tracking-wider">
                    Letzter Fehler
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-zinc-900 divide-y divide-gray-200 dark:divide-zinc-800">
                {Object.entries(groupedWorkflows).map(([groupKey, workflows]) => (
                  <Fragment key={groupKey}>
                    <tr>
                      <td colSpan={5} className="px-6 py-2 bg-gray-50 dark:bg-zinc-950/30 border-b border-gray-100 dark:border-zinc-800/50">
                        <button
                          onClick={() => toggleGroup(groupKey)}
                          className="flex items-center text-left w-full focus:outline-none group"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className={`h-5 w-5 mr-2 text-gray-400 dark:text-zinc-600 group-hover:text-gray-600 dark:group-hover:text-zinc-400 transition-transform duration-200 ${
                              collapsedGroups[groupKey] ? '' : 'rotate-90'
                            }`}
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <span className="text-sm font-semibold text-gray-700 dark:text-zinc-300">
                            {groupKey === '#' ? 'Sonstige' : groupKey}
                          </span>
                          <span className="ml-2 text-xs text-gray-500 dark:text-zinc-500 bg-white dark:bg-zinc-800 px-2 py-0.5 rounded-full border border-gray-200 dark:border-zinc-700">
                            {workflows.length}
                          </span>
                        </button>
                      </td>
                    </tr>
                    {!collapsedGroups[groupKey] && workflows.map((workflow) => (
                      <tr key={workflow.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 dark:border-zinc-700 text-blue-600 dark:text-emerald-600 focus:ring-blue-500 dark:focus:ring-emerald-500 dark:bg-zinc-800 dark:checked:bg-emerald-600"
                            checked={selectedWorkflows.includes(workflow.id)}
                            onChange={() => handleSelectWorkflow(workflow.id)}
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900 dark:text-zinc-100">
                            <a
                              href={`${instance.baseUrl.replace(/\/$/, '')}/workflow/${workflow.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 dark:text-emerald-400 hover:underline"
                            >
                              {workflow.name}
                            </a>
                          </div>
                          <div className="text-xs text-gray-500 dark:text-zinc-500 font-mono mt-0.5">{workflow.id}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full border ${
                            workflow.active
                              ? 'bg-green-50 text-green-700 border-green-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/30'
                              : 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'
                          }`}>
                            {workflow.active ? 'Aktiv' : 'Inaktiv'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-zinc-400">
                          {workflow.lastRunAt ? formatRelativeTime(workflow.lastRunAt) : 'Nie'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-zinc-400">
                          {workflow.lastErrorAt ? formatRelativeTime(workflow.lastErrorAt) : 'Kein Fehler'}
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'errors' && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 shadow-sm overflow-hidden">
          {eventsLoading ? (
            <div className="divide-y divide-gray-200 dark:divide-zinc-800">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-6">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <Skeleton className="h-5 w-16 rounded" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                      <Skeleton className="h-5 w-64 mt-2" />
                    </div>
                  </div>
                  <Skeleton className="h-16 w-full rounded mt-2" />
                </div>
              ))}
            </div>
          ) : instance.status === 'locked' ? (
            <LockedState />
          ) : !events || events.length === 0 ? (
            <div className="p-12 text-center text-gray-500 dark:text-zinc-500">Keine Fehler gefunden</div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-zinc-800">
              {events.map((event) => (
                <div key={event.id} className="p-6 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded border ${getSeverityColor(event.severity)}`}>
                          {event.severity}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-zinc-500">{formatRelativeTime(event.occurredAt)}</span>
                      </div>
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-zinc-100">
                        {event.payload?.workflowName ? (
                          <a
                            href={`${instance.baseUrl.replace(/\/$/, '')}/workflow/${event.payload.workflowId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-blue-600 dark:hover:text-emerald-400 hover:underline"
                          >
                            {event.payload.workflowName}
                          </a>
                        ) : (
                          'Unbekannter Workflow'
                        )}
                      </h4>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-zinc-300 mb-2 font-mono bg-gray-50 dark:bg-zinc-950/50 p-2 rounded border border-gray-100 dark:border-zinc-800">
                    {event.payload?.errorMessage || 'Keine Fehlermeldung verfügbar'}
                  </p>
                  {event.payload?.node && (
                    <p className="text-xs text-gray-500 dark:text-zinc-500">
                      Node: <span className="font-medium text-gray-700 dark:text-zinc-300">{event.payload.node}</span>
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'patterns' && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-zinc-800 flex justify-between items-center bg-gray-50/50 dark:bg-zinc-900/50">
            <h3 className="text-lg font-medium text-gray-900 dark:text-zinc-100">Häufigste Fehler</h3>
            <div className="flex space-x-2">
              {['1d', '14d', '1m', '6m', '12m'].map((range) => (
                <button
                  key={range}
                  onClick={() => setPatternRange(range)}
                  className={`px-3 py-1 text-xs font-medium rounded-full transition-all ${
                    patternRange === range
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                      : 'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>

          {patternsLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center space-x-4 py-2">
                  <div className="flex-1">
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                  <Skeleton className="h-6 w-12 rounded-full" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-16 w-48 rounded" />
                </div>
              ))}
            </div>
          ) : instance.status === 'locked' ? (
            <LockedState />
          ) : !patterns || patterns.length === 0 ? (
            <div className="p-12 text-center text-gray-500 dark:text-zinc-500">Keine Fehlermuster gefunden</div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-800">
              <thead className="bg-gray-50 dark:bg-zinc-950/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-500 uppercase tracking-wider">
                    Fehlermeldung
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-500 uppercase tracking-wider">
                    Anzahl
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-500 uppercase tracking-wider">
                    Zuletzt aufgetreten
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-500 uppercase tracking-wider">
                    Betroffene Workflows
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-zinc-900 divide-y divide-gray-200 dark:divide-zinc-800">
                {patterns.map((pattern, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-zinc-100 font-medium font-mono">
                      {pattern.errorMessage}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-zinc-400">
                      <span className="px-2.5 py-0.5 bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300 rounded-full text-xs font-bold border border-red-200 dark:border-red-900/30">
                        {pattern.count}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-zinc-400">
                      {formatRelativeTime(pattern.lastOccurred)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-zinc-400">
                      <div className="flex flex-wrap gap-1">
                        {pattern.affectedWorkflows.slice(0, 3).map((wf, i) => (
                          <span key={i} className="px-2 py-0.5 bg-gray-100 dark:bg-zinc-800 rounded text-xs border border-gray-200 dark:border-zinc-700">
                            {wf}
                          </span>
                        ))}
                        {pattern.affectedWorkflows.length > 3 && (
                          <span className="px-2 py-0.5 bg-gray-100 dark:bg-zinc-800 rounded text-xs text-gray-500 dark:text-zinc-500 border border-gray-200 dark:border-zinc-700">
                            +{pattern.affectedWorkflows.length - 3} weitere
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

