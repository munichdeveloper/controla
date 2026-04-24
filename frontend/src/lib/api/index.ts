// API Client für Backend-Kommunikation
import {
  InstanceSummary,
  InstanceDetail,
  Workflow,
  Event,
  MetricsResponse,
  AlertSettings,
  BackupSettings,
  LicenseInfo,
  InstanceIncidentDto,
  InstanceUptimeStatsDto,
  CompanionConfig,
  CompanionStatus,
  CompanionVersions,
  CompanionUpdateSettings,
  CompanionUpdateHistory,
  CompanionUpdateResponse,
} from '../types';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_BASE_URL || '/api';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function getAuthHeader(): HeadersInit {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      return { 'Authorization': `Bearer ${token}` };
    }
  }
  return {};
}

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
      ...options?.headers,
    },
  });

  if (response.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    throw new Error('Session expired');
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new ApiError(errorText || `API error: ${response.status} ${response.statusText}`, response.status);
  }

  return response.json();
}

// Auth API
export interface LoginResponse {
  token: string;
  username: string;
  email: string;
  role: string;
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    let errorMessage = 'Login fehlgeschlagen';
    try {
      // Clone the response so we can read it multiple times if needed
      const clonedResponse = response.clone();
      const text = await clonedResponse.text();

      if (text && text.trim().length > 0) {
        // Check if it's JSON by trying to parse it
        try {
          const json = JSON.parse(text);
          errorMessage = json.message || json.error || text;
        } catch {
          // Not JSON, use as plain text
          errorMessage = text;
        }
      } else {
        errorMessage = `Login fehlgeschlagen (${response.status} ${response.statusText})`;
      }
    } catch (e) {
      // Fallback if response body cannot be read
      errorMessage = `Login fehlgeschlagen (${response.status} ${response.statusText})`;
    }
    throw new Error(errorMessage);
  }

  // Success case - parse JSON response
  try {
    return await response.json();
  } catch (e) {
    throw new Error('Ungültige Antwort vom Server erhalten');
  }
}

export async function register(username: string, password: string, email: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password, email }),
  });

  if (!response.ok) {
    let errorMessage = 'Registrierung fehlgeschlagen';
    try {
      // Clone the response so we can read it multiple times if needed
      const clonedResponse = response.clone();
      const text = await clonedResponse.text();

      if (text && text.trim().length > 0) {
        // Check if it's JSON by trying to parse it
        try {
          const json = JSON.parse(text);
          errorMessage = json.message || json.error || text;
        } catch {
          // Not JSON, use as plain text
          errorMessage = text;
        }
      } else {
        errorMessage = `Registrierung fehlgeschlagen (${response.status} ${response.statusText})`;
      }
    } catch (e) {
      // Fallback if response body cannot be read
      errorMessage = `Registrierung fehlgeschlagen (${response.status} ${response.statusText})`;
    }
    throw new Error(errorMessage);
  }

  return response.text();
}

export async function getCurrentUser(): Promise<LoginResponse> {
  return fetchApi<LoginResponse>('/auth/me');
}

// Instance API
export async function getInstances(): Promise<InstanceSummary[]> {
  return fetchApi<InstanceSummary[]>('/instances');
}

export interface CreateInstanceRequest {
  name: string;
  baseUrl: string;
  apiKey: string;
}

export async function createInstance(data: CreateInstanceRequest): Promise<InstanceSummary> {
  return fetchApi<InstanceSummary>('/instances', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateInstance(id: string, data: Partial<CreateInstanceRequest>): Promise<InstanceSummary> {
  return fetchApi<InstanceSummary>(`/instances/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function getInstance(id: string): Promise<InstanceDetail> {
  return fetchApi<InstanceDetail>(`/instances/${id}`);
}

export async function getInstanceWorkflows(id: string): Promise<Workflow[]> {
  return fetchApi<Workflow[]>(`/instances/${id}/workflows`);
}

export interface GetEventsParams {
  type?: string;
  limit?: number;
}

export async function getInstanceEvents(
  id: string,
  params?: { type?: string; limit?: number }
): Promise<Event[]> {
  const query = new URLSearchParams();
  if (params?.type) query.append('type', params.type);
  if (params?.limit) query.append('limit', params.limit.toString());
  return fetchApi<Event[]>(`/instances/${id}/events?${query.toString()}`);
}

export interface ErrorPattern {
  errorMessage: string;
  count: number;
  lastOccurred: string;
  affectedWorkflows: string[];
}

export async function getInstanceErrorPatterns(
  id: string,
  range: string = '14d'
): Promise<ErrorPattern[]> {
  return fetchApi<ErrorPattern[]>(`/instances/${id}/error-patterns?range=${range}`);
}

export interface GetMetricsParams {
  type?: string;
  range?: string;
}

export async function getInstanceMetrics(
  id: string,
  params: GetMetricsParams = {}
): Promise<MetricsResponse> {
  const searchParams = new URLSearchParams();
  if (params.type) searchParams.set('type', params.type);
  if (params.range) searchParams.set('range', params.range);

  const query = searchParams.toString();
  return fetchApi<MetricsResponse>(`/instances/${id}/metrics${query ? `?${query}` : ''}`);
}

// Alert Settings API
export async function getAlertSettings(): Promise<AlertSettings> {
  return fetchApi<AlertSettings>('/alerts/settings');
}

export async function updateAlertSettings(settings: AlertSettings): Promise<AlertSettings> {
  return fetchApi<AlertSettings>('/alerts/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}

// Backup API
export async function getBackupSettings(): Promise<BackupSettings> {
  return fetchApi<BackupSettings>('/backups/settings');
}

export async function updateBackupSettings(settings: BackupSettings): Promise<BackupSettings> {
  return fetchApi<BackupSettings>('/backups/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}

export async function getAllLastBackups(): Promise<Record<string, string>> {
  return fetchApi<Record<string, string>>('/premium/instances/backups');
}

export async function getInstanceLastBackup(id: string): Promise<{ lastBackupAt: string }> {
  return fetchApi<{ lastBackupAt: string }>(`/premium/instances/${id}/backup`);
}

export async function getInstanceIncidents(externalId: string): Promise<InstanceIncidentDto[]> {
  return fetchApi<InstanceIncidentDto[]>(`/premium/instances/${externalId}/incidents`);
}

export async function getInstanceUptimeStats(externalId: string): Promise<InstanceUptimeStatsDto> {
  return fetchApi<InstanceUptimeStatsDto>(`/premium/instances/${externalId}/uptime`);
}

export async function getLicenseInfo(): Promise<LicenseInfo> {
  return fetchApi<LicenseInfo>('/license');
}

export async function exportInstanceWorkflows(id: string, workflowIds?: string[]): Promise<Blob> {
  const query = new URLSearchParams();
  if (workflowIds && workflowIds.length > 0) {
    query.append('ids', workflowIds.join(','));
  }

  const response = await fetch(`${API_BASE_URL}/instances/${id}/export?${query.toString()}`, {
    method: 'GET',
    headers: {
      ...getAuthHeader(),
    },
  });

  if (!response.ok) {
    throw new Error('Export fehlgeschlagen');
  }

  return response.blob();
}

export async function importWorkflow(instanceId: string, workflowJson: any): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/premium/instances/${instanceId}/import`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
    body: JSON.stringify(workflowJson),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Import failed: ${response.statusText}`);
  }
}

export interface VersionInfo {
  version: string;
}

export async function getVersion(): Promise<VersionInfo> {
  return fetchApi<VersionInfo>('/version');
}

// Companion API (Premium)
export async function getCompanionConfig(externalId: string): Promise<CompanionConfig> {
  return fetchApi<CompanionConfig>(`/premium/companion/${externalId}/config`);
}

export async function updateCompanionConfig(externalId: string, config: CompanionConfig): Promise<CompanionConfig> {
  return fetchApi<CompanionConfig>(`/premium/companion/${externalId}/config`, {
    method: 'PUT',
    body: JSON.stringify(config),
  });
}

export async function deleteCompanionConfig(externalId: string): Promise<void> {
  return fetchApi<void>(`/premium/companion/${externalId}/config`, {
    method: 'DELETE',
  });
}

export async function getCompanionStatus(externalId: string): Promise<CompanionStatus> {
  return fetchApi<CompanionStatus>(`/premium/companion/${externalId}/status`);
}

export async function getCompanionVersions(externalId: string): Promise<CompanionVersions> {
  return fetchApi<CompanionVersions>(`/premium/companion/${externalId}/versions`);
}

export async function getCompanionUpdateSettings(externalId: string): Promise<CompanionUpdateSettings> {
  return fetchApi<CompanionUpdateSettings>(`/premium/companion/${externalId}/update-settings`);
}

export async function updateCompanionUpdateSettings(externalId: string, settings: CompanionUpdateSettings): Promise<CompanionUpdateSettings> {
  return fetchApi<CompanionUpdateSettings>(`/premium/companion/${externalId}/update-settings`, {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}

export async function startCompanionUpdate(externalId: string, targetVersion?: string): Promise<CompanionUpdateResponse> {
  return fetchApi<CompanionUpdateResponse>(`/premium/companion/${externalId}/update`, {
    method: 'POST',
    body: JSON.stringify(targetVersion ? { version: targetVersion } : {}),
  });
}

export async function scheduleCompanionUpdate(externalId: string, scheduledAt: string): Promise<{ message: string }> {
  return fetchApi<{ message: string }>(`/premium/companion/${externalId}/update/schedule`, {
    method: 'POST',
    body: JSON.stringify({ scheduledAt }),
  });
}

export async function cancelScheduledUpdate(externalId: string): Promise<void> {
  return fetchApi<void>(`/premium/companion/${externalId}/update/schedule`, {
    method: 'DELETE',
  });
}

export async function getCompanionUpdateHistory(externalId: string, page: number = 0, size: number = 20): Promise<CompanionUpdateHistory[]> {
  return fetchApi<CompanionUpdateHistory[]>(`/premium/companion/${externalId}/update/history?page=${page}&size=${size}`);
}

export async function startCompanionContainer(externalId: string): Promise<{ success: boolean; output: string }> {
  return fetchApi<{ success: boolean; output: string }>(`/premium/companion/${externalId}/start`, {
    method: 'POST',
  });
}

export async function stopCompanionContainer(externalId: string): Promise<{ success: boolean; output: string }> {
  return fetchApi<{ success: boolean; output: string }>(`/premium/companion/${externalId}/stop`, {
    method: 'POST',
  });
}

export async function pullCompanionImage(externalId: string): Promise<{ success: boolean; output: string }> {
  return fetchApi<{ success: boolean; output: string }>(`/premium/companion/${externalId}/pull`, {
    method: 'POST',
  });
}

export async function pinCompanionVersion(externalId: string, version: string): Promise<{ success: boolean; output: string }> {
  return fetchApi<{ success: boolean; output: string }>(`/premium/companion/${externalId}/version`, {
    method: 'POST',
    body: JSON.stringify({ version }),
  });
}

