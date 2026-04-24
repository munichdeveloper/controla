// TypeScript Types für API-Responses

export interface InstanceSummary {
  id: string;
  name: string;
  baseUrl: string;
  status: 'online' | 'offline' | 'unknown';
  version: string;
  lastSeenAt: string;
}

export interface InstanceDetail {
  id: string;
  name: string;
  baseUrl: string;
  status: 'online' | 'offline' | 'unknown';
  version: string;
  lastSeenAt: string;
  createdAt: string;
}

export interface Workflow {
  id: string;
  name: string;
  active: boolean;
  lastErrorAt: string | null;
  lastRunAt: string | null;
}

export interface Event {
  id: string;
  eventType: string;
  severity: string;
  occurredAt: string;
  payload: {
    workflowId?: string;
    workflowName?: string;
    errorMessage?: string;
    node?: string;
    [key: string]: any;
  };
}

export interface MetricPoint {
  value: number;
  measuredAt: string;
}

export interface MetricsResponse {
  metricType: string;
  unit: string;
  points: MetricPoint[];
}

export interface AlertSettings {
  email: string;
  enabled: boolean;
  notifyOnInstanceOffline: boolean;
  notifyOnWorkflowError: boolean;
  notifyOnInvalidApiKey: boolean;
}

export interface BackupSettings {
  enabled: boolean;
  googleDriveFolderId: string;
  intervalHours: number;
  lastBackupAt?: string;
}

export interface LicenseInfo {
  edition: string;
  maxInstances: number;
  features: {
    [key: string]: boolean;
  };
}

export interface InstanceIncidentDto {
  id: number;
  startedAt: string;
  resolvedAt: string | null;
  resolved: boolean;
  downtimeSeconds: number;
  message: string;
}

export interface InstanceUptimeStatsDto {
  last24Hours: number;
  last7Days: number;
  last30Days: number;
  last3Months: number;
  last6Months: number;
  last12Months: number;
}

export interface VersionInfo {
  version: string;
}

// Companion API Types
export interface CompanionConfig {
  host: string;
  port: number;
  apiKey: string;
  apiKeyChanged: boolean;
}

export interface CompanionStatus {
  configured: boolean;
  connected: boolean;
  containerStatus: 'running' | 'exited' | 'stopped' | 'unknown';
  pinnedVersion: string;
  runningVersion: string;
  updating: boolean;
  updatePhase?: 'PULLING' | 'RESTARTING' | 'VERIFYING' | null;
}

export interface CompanionVersions {
  versions: string[];
}

export interface CompanionUpdateSettings {
  autoUpdateEnabled: boolean;
  scheduledUpdateAt?: string | null;
}

export interface CompanionUpdateHistory {
  id: number;
  executedAt: string;
  fromVersion: string;
  toVersion: string;
  status: 'SUCCESS' | 'FAILED' | 'IN_PROGRESS';
  triggerType: 'AUTO' | 'MANUAL' | 'SCHEDULED';
  errorMessage?: string | null;
}

export interface CompanionUpdateResponse {
  message: string;
  targetVersion: string;
}
