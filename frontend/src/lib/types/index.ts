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

export interface VersionInfo {
  version: string;
}