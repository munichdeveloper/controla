'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ApiError,
  getInstance,
  getInstanceWorkflows,
  getInstanceEvents,
  getInstanceErrorPatterns,
  exportInstanceWorkflows,
  getInstanceLastBackup,
  getInstanceIncidents,
  getInstanceUptimeStats,
  importWorkflow,
} from '@/lib/api';
import { formatDate, formatRelativeTime, getStatusColor, getSeverityColor, getVersionUpdateState } from '@/lib/utils';
import { useState, useMemo, Fragment, useRef } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { useParams } from 'next/navigation';
import { useLicense } from '@/lib/license/LicenseContext';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { Skeleton } from '@/components/Skeleton';
import { CompanionSection, CompanionIndicator } from '@/components/companion';
import { DiagnosticsSection } from '@/components/diagnostics/DiagnosticsSection';
import { DiagnosticSnapshotDialog } from '@/components/diagnostics/DiagnosticSnapshotDialog';
import { FEATURES } from '@/lib/license/features';

function VersionBadge({ version, latestVersion }) {
  const updateState = getVersionUpdateState(version, latestVersion);

  if (updateState === 'up-to-date') {
    return (
      <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
        aktuell
      </span>
    );
  }

  if (updateState !== 'update-available') {
    return null;
  }

  return (
    <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-warning/10 text-warning">
      Update verfügbar: {latestVersion}
    </span>
  );
}

function LockedState() {
  return (
    <div className="p-12 text-center">
      <div className="inline-flex items-center justify-center p-4 bg-warning/5 rounded-full mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-8 h-8 text-warning">
          <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
        </svg>
      </div>
      <h3 className="text-lg font-medium text-foreground mb-2">Instanz ist gesperrt</h3>
      <p className="text-muted max-w-md mx-auto">
        Daten können nicht angezeigt werden, da der API Key nicht entschlüsselt werden konnte. Bitte melde dich erneut an.
      </p>
    </div>
  );
}

function isNotFoundError(error) {
  if (!error) return false;
  if (error instanceof ApiError) return error.status === 404;
  if (typeof error === 'object' && error !== null && 'status' in error) {
    return error.status === 404;
  }
  if (error instanceof Error) {
    return error.message.includes('404');
  }
  return false;
}

function formatDowntime(seconds) {
  if (!seconds || seconds <= 0) return '0s';

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (secs || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
}

function formatPercent(value) {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(numeric)) return '-';
  return `${numeric.toFixed(2)}%`;
}

const uptimeFields = [
  { key: 'last24Hours', label: 'Letzte 24 Stunden' },
  { key: 'last7Days', label: 'Letzte 7 Tage' },
  { key: 'last30Days', label: 'Letzte 30 Tage' },
  { key: 'last3Months', label: 'Letzte 3 Monate' },
  { key: 'last6Months', label: 'Letzte 6 Monate' },
  { key: 'last12Months', label: 'Letzte 12 Monate' },
];

const STATUS_TEXT = { online: 'Online', offline: 'Nicht erreichbar', locked: 'Gesperrt', unknown: 'Unbekannt' };

export default function InstanceDetailPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [patternRange, setPatternRange] = useState('14d');
  const [workflowFilter, setWorkflowFilter] = useState('active'); // 'active', 'inactive', 'all'
  const [selectedWorkflows, setSelectedWorkflows] = useState([]);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const { id: instanceId } = useParams();
  const { isPremium, isFeatureEnabled } = useLicense();
  const importEnabled = isFeatureEnabled(FEATURES.WORKFLOW_IMPORT);
  const backupsEnabled = isFeatureEnabled(FEATURES.BACKUP_SCHEDULED);
  const companionEnabled = isFeatureEnabled(FEATURES.COMPANION_MANAGE);
  const diagnosticsEnabled = isFeatureEnabled(FEATURES.DIAGNOSTICS_REPORT);
  const snapshotsEnabled = isFeatureEnabled(FEATURES.COMPANION_DIAG_SNAPSHOTS);
  const [openSnapshotId, setOpenSnapshotId] = useState(null);
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);

  const { data: instance, isLoading: instanceLoading, error: instanceError } = useQuery({
    queryKey: ['instance', instanceId],
    queryFn: () => getInstance(instanceId),
  });

  const { data: lastBackupData } = useQuery({
    queryKey: ['instanceBackup', instanceId],
    queryFn: () => getInstanceLastBackup(instanceId),
    enabled: backupsEnabled && !!instanceId,
  });

  const { data: workflows, isLoading: workflowsLoading } = useQuery({
    queryKey: ['workflows', instanceId],
    queryFn: () => getInstanceWorkflows(instanceId),
    enabled: activeTab === 'workflows',
  });

  const { data: incidents, isLoading: incidentsLoading, error: incidentsError } = useQuery({
    queryKey: ['instanceIncidents', instanceId],
    queryFn: () => getInstanceIncidents(instanceId),
    enabled: isPremium && activeTab === 'incidents' && !!instanceId,
  });

  const { data: uptimeStats, isLoading: uptimeLoading, error: uptimeError } = useQuery({
    queryKey: ['instanceUptime', instanceId],
    queryFn: () => getInstanceUptimeStats(instanceId),
    enabled: isPremium && activeTab === 'uptime' && !!instanceId,
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

  const sortedIncidents = useMemo(() => {
    if (!incidents) return [];
    return [...incidents].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }, [incidents]);

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
        <div className="border-b border-border mb-8">
          <div className="flex space-x-8">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-10 w-24" />
            ))}
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-8">
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
      <div className="bg-danger/5 border border-danger/20 rounded-lg p-4">
        <h3 className="text-danger font-semibold">Instanz nicht gefunden</h3>
      </div>
    );
  }

  const instanceNotFound = isNotFoundError(instanceError);
  const premiumNotFound = isPremium && (isNotFoundError(incidentsError) || isNotFoundError(uptimeError));

  if (instanceNotFound || premiumNotFound) {
    return (
      <div className="bg-danger/5 border border-danger/20 rounded-lg p-4">
        <h3 className="text-danger font-semibold">Instanz nicht gefunden</h3>
      </div>
    );
  }

  return (
    <div>
       {/* Header */}
      <PageHeader
        back={{ href: '/', label: 'Alle Instanzen' }}
        eyebrow="Instanz"
        title={
          <span className="inline-flex flex-wrap items-center gap-3">
            {instance.name}
            <CompanionIndicator externalId={instanceId} />
          </span>
        }
        description={<span className="font-mono text-sm">{instance.baseUrl}</span>}
        actions={
          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium ${getStatusColor(instance.status)}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
            {STATUS_TEXT[instance.status] || instance.status}
          </span>
        }
      />

      {instance.status === 'locked' && (
        <div className="mb-6 bg-warning/5 border border-warning/20 rounded-xl p-4 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-warning mr-3">
            <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
          </svg>
          <div>
            <p className="text-warning font-medium">Instanz ist gesperrt</p>
            <p className="text-warning text-sm">
              Der API Key konnte nicht entschlüsselt werden. Bitte melde dich erneut an, um den Zugriff wiederherzustellen.
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-border mb-8">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'overview'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-foreground hover:border-border'
            }`}
          >
            Übersicht
          </button>
          <button
            onClick={() => setActiveTab('workflows')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'workflows'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-foreground hover:border-border'
            }`}
          >
            Workflows
          </button>
          <button
            onClick={() => setActiveTab('errors')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'errors'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-foreground hover:border-border'
            }`}
          >
            Fehler
          </button>
          <button
            onClick={() => setActiveTab('patterns')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'patterns'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-foreground hover:border-border'
            }`}
          >
            Fehlermuster
          </button>
          {diagnosticsEnabled && (
            <button
              onClick={() => setActiveTab('diagnostics')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'diagnostics'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted hover:text-foreground hover:border-border'
              }`}
            >
              Diagnose
            </button>
          )}
           {isPremium && (
             <>
               {companionEnabled && <button
                 onClick={() => setActiveTab('companion')}
                 className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                   activeTab === 'companion'
                     ? 'border-primary text-primary'
                     : 'border-transparent text-muted hover:text-foreground hover:border-border'
                 }`}
               >
                 Companion
               </button>}
               <button
                 onClick={() => setActiveTab('incidents')}
                 className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                   activeTab === 'incidents'
                     ? 'border-primary text-primary'
                     : 'border-transparent text-muted hover:text-foreground hover:border-border'
                 }`}
               >
                 Incidents
               </button>
               <button
                 onClick={() => setActiveTab('uptime')}
                 className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                   activeTab === 'uptime'
                     ? 'border-primary text-primary'
                     : 'border-transparent text-muted hover:text-foreground hover:border-border'
                 }`}
               >
                 Uptime
               </button>
             </>
           )}
        </nav>
      </div>

      {/* Content */}
      {activeTab === 'overview' && (
        <div className="bg-card rounded-xl border border-border p-8">
          <h3 className="text-lg font-semibold text-foreground mb-6">Basis-Informationen</h3>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <span className="font-mono text-xs text-muted uppercase tracking-wide">Version</span>
              <div className="flex items-center mt-1">
                <p className="text-foreground font-medium text-lg">{instance.version}</p>
                <VersionBadge
                  version={instance.version}
                  latestVersion={instance.latestVersion}
                />
              </div>
            </div>
            <div>
              <span className="font-mono text-xs text-muted uppercase tracking-wide">Status</span>
              <div className="mt-1">
                <span className={`px-2.5 py-0.5 rounded-full text-sm font-medium border ${getStatusColor(instance.status)} capitalize`}>
                  {instance.status}
                </span>
              </div>
            </div>
            <div>
              <span className="font-mono text-xs text-muted uppercase tracking-wide">URL</span>
              <a
                href={instance.baseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary font-medium text-lg mt-1 hover:underline block truncate"
              >
                {instance.baseUrl}
              </a>
            </div>
            <div>
              <span className="font-mono text-xs text-muted uppercase tracking-wide">Zuletzt gesehen</span>
              <p className="text-foreground font-medium text-lg mt-1">{formatRelativeTime(instance.lastSeenAt)}</p>
              <p className="text-xs text-muted mt-0.5">{formatDate(instance.lastSeenAt)}</p>
            </div>
            <div>
              <span className="font-mono text-xs text-muted uppercase tracking-wide">Erstellt am</span>
              <p className="text-foreground font-medium text-lg mt-1">{formatDate(instance.createdAt)}</p>
            </div>
            {backupsEnabled && (
              <div>
                <span className="font-mono text-xs text-muted uppercase tracking-wide">Letztes Backup</span>
                <p className="text-foreground font-medium text-lg mt-1">
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
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border flex justify-between items-center bg-background/50">
            <div className="flex items-center space-x-3">
              <h3 className="text-lg font-medium text-foreground">Workflows</h3>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".json"
                className="hidden"
              />
              {importEnabled && (
                <button
                  onClick={handleImportClick}
                  disabled={isImporting}
                  title="Workflow importieren"
                  className="p-1.5 rounded-md text-muted hover:text-primary hover:bg-soft transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                  className="bg-primary text-on-primary px-3 py-1.5 text-xs font-medium rounded-full hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-colors"
                >
                  {isExporting ? 'Exportiere...' : `Exportieren (${selectedWorkflows.length})`}
                </button>
              )}
              <div className="flex space-x-2">
                <button
                  onClick={() => setWorkflowFilter('active')}
                  className={`px-3 py-1 text-xs font-medium rounded-full transition-all ${
                    workflowFilter === 'active'
                      ? 'bg-primary/10 text-primary'
                      : 'bg-soft text-muted hover:bg-soft'
                  }`}
                >
                  Aktiv
                </button>
                <button
                  onClick={() => setWorkflowFilter('inactive')}
                  className={`px-3 py-1 text-xs font-medium rounded-full transition-all ${
                    workflowFilter === 'inactive'
                      ? 'bg-primary/10 text-primary'
                      : 'bg-soft text-muted hover:bg-soft'
                  }`}
                >
                  Inaktiv
                </button>
                <button
                  onClick={() => setWorkflowFilter('all')}
                  className={`px-3 py-1 text-xs font-medium rounded-full transition-all ${
                    workflowFilter === 'all'
                      ? 'bg-primary/10 text-primary'
                      : 'bg-soft text-muted hover:bg-soft'
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
            <div className="p-12 text-center text-muted">Keine Workflows gefunden</div>
          ) : (
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-background">
                <tr>
                  <th className="px-6 py-3 text-left font-mono text-[10px] font-normal text-muted uppercase tracking-wide w-10">
                    <input
                      type="checkbox"
                      className="rounded border-border text-primary focus:ring-primary/40"
                      checked={filteredWorkflows.length > 0 && selectedWorkflows.length === filteredWorkflows.length}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th className="px-6 py-3 text-left font-mono text-[10px] font-normal text-muted uppercase tracking-wide">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left font-mono text-[10px] font-normal text-muted uppercase tracking-wide">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left font-mono text-[10px] font-normal text-muted uppercase tracking-wide">
                    Letzter Lauf
                  </th>
                  <th className="px-6 py-3 text-left font-mono text-[10px] font-normal text-muted uppercase tracking-wide">
                    Letzter Fehler
                  </th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                {Object.entries(groupedWorkflows).map(([groupKey, workflows]) => (
                  <Fragment key={groupKey}>
                    <tr>
                      <td colSpan={5} className="px-6 py-2 bg-background border-b border-border">
                        <button
                          onClick={() => toggleGroup(groupKey)}
                          className="flex items-center text-left w-full focus:outline-none group"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className={`h-5 w-5 mr-2 text-muted group-hover:text-muted transition-transform duration-200 ${
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
                          <span className="text-sm font-semibold text-muted">
                            {groupKey === '#' ? 'Sonstige' : groupKey}
                          </span>
                          <span className="ml-2 text-xs text-muted bg-card px-2 py-0.5 rounded-full border border-border">
                            {workflows.length}
                          </span>
                        </button>
                      </td>
                    </tr>
                    {!collapsedGroups[groupKey] && workflows.map((workflow) => (
                      <tr key={workflow.id} className="hover:bg-background transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            className="rounded border-border text-primary focus:ring-primary/40"
                            checked={selectedWorkflows.includes(workflow.id)}
                            onChange={() => handleSelectWorkflow(workflow.id)}
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-foreground">
                            <a
                              href={`${instance.baseUrl.replace(/\/$/, '')}/workflow/${workflow.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              {workflow.name}
                            </a>
                          </div>
                          <div className="text-xs text-muted font-mono mt-0.5">{workflow.id}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full border ${
                            workflow.active
                              ? 'bg-primary/5 text-primary border-primary/20'
                              : 'bg-background text-muted border-border'
                          }`}>
                            {workflow.active ? 'Aktiv' : 'Inaktiv'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                          {workflow.lastRunAt ? formatRelativeTime(workflow.lastRunAt) : 'Nie'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
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
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {eventsLoading ? (
            <div className="divide-y divide-border">
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
            <div className="p-12 text-center text-muted">Keine Fehler gefunden</div>
          ) : (
            <div className="divide-y divide-border">
              {events.map((event) => (
                <div key={event.id} className="p-6 hover:bg-background transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded border ${getSeverityColor(event.severity)}`}>
                          {event.severity}
                        </span>
                        <span className="text-sm text-muted">{formatRelativeTime(event.occurredAt)}</span>
                      </div>
                      <h4 className="text-sm font-semibold text-foreground">
                        {event.payload?.workflowName ? (
                          <a
                            href={`${instance.baseUrl.replace(/\/$/, '')}/workflow/${event.payload.workflowId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-primary hover:underline"
                          >
                            {event.payload.workflowName}
                          </a>
                        ) : (
                          'Unbekannter Workflow'
                        )}
                      </h4>
                    </div>
                  </div>
                  <p className="text-sm text-muted mb-2 font-mono bg-background p-2 rounded border border-border">
                    {event.payload?.errorMessage || 'Keine Fehlermeldung verfügbar'}
                  </p>
                  {event.payload?.node && (
                    <p className="text-xs text-muted">
                      Node: <span className="font-medium text-muted">{event.payload.node}</span>
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'patterns' && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border flex justify-between items-center bg-background/50">
            <h3 className="text-lg font-medium text-foreground">Häufigste Fehler</h3>
            <div className="flex space-x-2">
              {['1d', '14d', '1m', '6m', '12m'].map((range) => (
                <button
                  key={range}
                  onClick={() => setPatternRange(range)}
                  className={`px-3 py-1 text-xs font-medium rounded-full transition-all ${
                    patternRange === range
                      ? 'bg-primary/10 text-primary'
                      : 'bg-soft text-muted hover:bg-soft'
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
            <div className="p-12 text-center text-muted">Keine Fehlermuster gefunden</div>
          ) : (
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-background">
                <tr>
                  <th className="px-6 py-3 text-left font-mono text-[10px] font-normal text-muted uppercase tracking-wide">
                    Fehlermeldung
                  </th>
                  <th className="px-6 py-3 text-left font-mono text-[10px] font-normal text-muted uppercase tracking-wide">
                    Anzahl
                  </th>
                  <th className="px-6 py-3 text-left font-mono text-[10px] font-normal text-muted uppercase tracking-wide">
                    Zuletzt aufgetreten
                  </th>
                  <th className="px-6 py-3 text-left font-mono text-[10px] font-normal text-muted uppercase tracking-wide">
                    Betroffene Workflows
                  </th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                {patterns.map((pattern, idx) => (
                  <tr key={idx} className="hover:bg-background transition-colors">
                    <td className="px-6 py-4 text-sm text-foreground font-medium font-mono">
                      {pattern.errorMessage}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                      <span className="px-2.5 py-0.5 bg-danger/10 text-danger rounded-full text-xs font-semibold border border-danger/20">
                        {pattern.count}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                      {formatRelativeTime(pattern.lastOccurred)}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted">
                      <div className="flex flex-wrap gap-1">
                        {pattern.affectedWorkflows.slice(0, 3).map((wf, i) => (
                          <span key={i} className="px-2 py-0.5 bg-soft rounded text-xs border border-border">
                            {wf}
                          </span>
                        ))}
                        {pattern.affectedWorkflows.length > 3 && (
                          <span className="px-2 py-0.5 bg-soft rounded text-xs text-muted border border-border">
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

      {isPremium && activeTab === 'incidents' && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border bg-background/50">
            <h3 className="text-lg font-medium text-foreground">Incidents</h3>
          </div>

          {incidentsLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="grid grid-cols-5 gap-4 items-center">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </div>
          ) : instance.status === 'locked' ? (
            <LockedState />
          ) : incidentsError ? (
            <div className="p-6">
              <div className="bg-danger/5 border border-danger/20 rounded-lg p-4">
                <h4 className="text-danger font-semibold mb-1">Incidents konnten nicht geladen werden</h4>
                <p className="text-danger text-sm">{incidentsError.message || 'Bitte versuche es erneut.'}</p>
              </div>
            </div>
          ) : sortedIncidents.length === 0 ? (
            <div className="p-12 text-center text-muted">Keine Incidents gefunden</div>
          ) : (
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-background">
                <tr>
                  <th className="px-6 py-3 text-left font-mono text-[10px] font-normal text-muted uppercase tracking-wide">Start</th>
                  <th className="px-6 py-3 text-left font-mono text-[10px] font-normal text-muted uppercase tracking-wide">Ende</th>
                  <th className="px-6 py-3 text-left font-mono text-[10px] font-normal text-muted uppercase tracking-wide">Dauer</th>
                  <th className="px-6 py-3 text-left font-mono text-[10px] font-normal text-muted uppercase tracking-wide">Status</th>
                  <th className="px-6 py-3 text-left font-mono text-[10px] font-normal text-muted uppercase tracking-wide">Message</th>
                  {snapshotsEnabled && (
                    <th className="px-6 py-3 text-left font-mono text-[10px] font-normal text-muted uppercase tracking-wide">Diagnose</th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                {sortedIncidents.map((incident) => {
                  const isOpen = !incident.resolved && !incident.resolvedAt;

                  return (
                    <tr key={incident.id} className="hover:bg-background transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">{formatDate(incident.startedAt)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                        {incident.resolvedAt ? formatDate(incident.resolvedAt) : 'offen'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">{formatDowntime(incident.downtimeSeconds)}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full border ${
                          isOpen
                            ? 'bg-warning/5 text-warning border-warning/20'
                            : 'bg-primary/5 text-primary border-primary/20'
                        }`}>
                          {isOpen ? 'Offen' : 'Resolved'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted">{incident.message || '-'}</td>
                      {snapshotsEnabled && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {incident.diagnosticSnapshotId ? (
                            <button
                              onClick={() => setOpenSnapshotId(incident.diagnosticSnapshotId)}
                              className="text-primary hover:underline"
                            >
                              Snapshot anzeigen
                            </button>
                          ) : (
                            <span className="text-muted">–</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

       {isPremium && activeTab === 'uptime' && (
         <div className="bg-card rounded-xl border border-border overflow-hidden">
           <div className="p-4 border-b border-border bg-background/50">
             <h3 className="text-lg font-medium text-foreground">Uptime</h3>
           </div>

           {uptimeLoading ? (
             <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
               {uptimeFields.map((field) => (
                 <div key={field.key} className="rounded-lg border border-border p-4">
                   <Skeleton className="h-4 w-28 mb-2" />
                   <Skeleton className="h-7 w-20" />
                 </div>
               ))}
             </div>
           ) : instance.status === 'locked' ? (
             <LockedState />
           ) : uptimeError ? (
             <div className="p-6">
               <div className="bg-danger/5 border border-danger/20 rounded-lg p-4">
                 <h4 className="text-danger font-semibold mb-1">Uptime konnte nicht geladen werden</h4>
                 <p className="text-danger text-sm">{uptimeError.message || 'Bitte versuche es erneut.'}</p>
               </div>
             </div>
           ) : !uptimeStats ? (
             <div className="p-12 text-center text-muted">Keine Uptime-Daten verfügbar</div>
           ) : (
             <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
               {uptimeFields.map((field) => (
                 <div key={field.key} className="rounded-xl border border-border p-4 bg-background">
                   <p className="font-mono text-[10px] uppercase tracking-wide text-muted sm:text-xs">{field.label}</p>
                   <p className="mt-2 font-display text-3xl font-semibold text-foreground">{formatPercent(uptimeStats[field.key])}</p>
                 </div>
               ))}
             </div>
           )}
         </div>
       )}

       {companionEnabled && activeTab === 'companion' && (
         <CompanionSection externalId={instanceId} />
       )}

       {diagnosticsEnabled && activeTab === 'diagnostics' && (
         <DiagnosticsSection
           externalId={instanceId}
           onOpenCompanionTab={companionEnabled ? () => setActiveTab('companion') : undefined}
         />
       )}

       {snapshotsEnabled && openSnapshotId !== null && (
         <DiagnosticSnapshotDialog
           externalId={instanceId}
           snapshotId={openSnapshotId}
           onClose={() => setOpenSnapshotId(null)}
         />
       )}
    </div>
  );
}

