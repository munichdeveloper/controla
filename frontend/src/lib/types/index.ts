// TypeScript Types für API-Responses

export interface InstanceSummary {
  id: string;
  name: string;
  baseUrl: string;
  status: 'online' | 'offline' | 'unknown';
  version: string;
  latestVersion?: string;
  lastSeenAt: string;
}

export interface InstanceDetail {
  id: string;
  name: string;
  baseUrl: string;
  status: 'online' | 'offline' | 'unknown';
  version: string;
  latestVersion?: string;
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
  /** Diagnostic snapshot captured when the incident started (Premium). */
  diagnosticSnapshotId?: number | null;
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
  /** Version of the companion itself; null for companions older than 0.2.0. */
  companionVersion?: string | null;
  /** Capabilities reported by the companion; empty for companions older than 0.2.0. */
  capabilities?: string[];
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

// Diagnostics
export type DiagnosticStatus = 'OK' | 'WARN' | 'FAIL' | 'SKIPPED' | 'ERROR';
export type DiagnosticCategory = 'CONNECTIVITY' | 'N8N' | 'WORKFLOWS' | 'CONTAINER' | 'HOST' | 'LOGS';

export interface DiagnosticResult {
  id: string;
  category: DiagnosticCategory;
  status: DiagnosticStatus;
  title: string;
  summary: string;
  hint: string | null;
  details: Record<string, unknown>;
  durationMs: number;
}

export interface DiagnosticConclusion {
  id: string;
  severity: DiagnosticStatus;
  title: string;
  explanation: string;
  relatedCheckIds: string[];
}

export interface DiagnosticReport {
  instanceId: string;
  generatedAt: string;
  durationMs: number;
  overallStatus: DiagnosticStatus;
  conclusions: DiagnosticConclusion[];
  checks: DiagnosticResult[];
}

export interface CompanionServiceSummary {
  service: string;
  container: string | null;
  state: string | null;
  status: string | null;
  health: string | null;
  image: string | null;
  exitCode: number | null;
}

export interface CompanionServices {
  project: string;
  services: CompanionServiceSummary[];
}

export interface CompanionEnvEntry {
  key: string;
  value: string | null;
  masked: boolean;
}

export interface CompanionContainer {
  service: string;
  id: string;
  name: string;
  image: string | null;
  imageId: string | null;
  createdAt: string | null;
  command: string[];
  state: {
    status: string | null;
    running: boolean;
    restarting: boolean;
    oomKilled: boolean;
    dead: boolean;
    exitCode: number | null;
    error: string | null;
    startedAt: string | null;
    finishedAt: string | null;
    health: {
      status: string;
      failingStreak: number;
      lastChecks: Array<{ start: string | null; exitCode: number | null; output: string }>;
    } | null;
  };
  restartCount: number;
  restartPolicy: string | null;
  limits: { memoryBytes: number | null; cpus: number | null };
  mounts: Array<{ type: string | null; source: string | null; destination: string | null; rw: boolean }>;
  ports: Array<{ containerPort: string; hostIp: string | null; hostPort: string | null }>;
  networks: string[];
  env: CompanionEnvEntry[];
}

export interface CompanionLogLine {
  ts: string | null;
  stream: 'stdout' | 'stderr';
  message: string;
}

export interface CompanionLogFinding {
  line: number;
  patternId: string;
  title: string;
  hint: string;
  severity: 'WARN' | 'FAIL';
}

export interface CompanionLogs {
  service: string;
  lines: CompanionLogLine[];
  truncated: boolean;
  redacted: boolean;
  findings: CompanionLogFinding[];
}

export interface CompanionStats {
  service: string;
  cpuPercent: number | null;
  memUsageBytes: number | null;
  memLimitBytes: number | null;
  memPercent: number | null;
  netRxBytes: number | null;
  netTxBytes: number | null;
  blockReadBytes: number | null;
  blockWriteBytes: number | null;
  pids: number | null;
  sampledAt: string;
}

export interface CompanionHost {
  docker: {
    serverVersion: string | null;
    os: string | null;
    kernel: string | null;
    architecture: string | null;
    cpus: number | null;
    memTotalBytes: number | null;
    storageDriver: string | null;
  } | null;
  compose: { version: string | null };
  diskUsage: Array<{ type: string; totalCount: number | null; active: number | null; size: string | null; reclaimable: string | null }>;
  filesystems: Array<{ label: string; path: string; totalBytes: number; freeBytes: number }>;
  warnings: string[];
}

export interface CompanionContainerEvent {
  time: string;
  action: string;
  exitCode: number | null;
  signal: string | null;
  healthStatus: string | null;
}

export interface CompanionEvents {
  service: string;
  since: string;
  events: CompanionContainerEvent[];
}

export interface DiagnosticSnapshotSummary {
  id: number;
  incidentId: number | null;
  trigger: 'INCIDENT' | 'MANUAL';
  capturedAt: string;
  companionVersion: string | null;
  error: string | null;
}

export interface DiagnosticSnapshot extends DiagnosticSnapshotSummary {
  payload: {
    container?: CompanionContainer | null;
    logs?: CompanionLogs | null;
    events?: CompanionEvents | null;
    stats?: CompanionStats | null;
    n8nHealth?: unknown;
    errors?: Record<string, string>;
  } | null;
}

export interface ContainerAlertSettings {
  containerOom: boolean;
  containerCrashLoop: boolean;
  containerUnhealthy: boolean;
}
