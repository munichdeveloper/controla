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
} from '../types';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_BASE_URL || '/api';

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
    throw new Error(errorText || `API error: ${response.status} ${response.statusText}`);
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
    const error = await response.text();
    throw new Error(error || 'Login fehlgeschlagen');
  }

  return response.json();
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
    const error = await response.text();
    throw new Error(error || 'Registrierung fehlgeschlagen');
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

