import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_API_URL } from './theme';

const KEYS = {
  apiUrl: 'presence_api_url',
  token: 'presence_token',
  deviceId: 'presence_device_id',
  deviceName: 'presence_device_name',
  branchCode: 'presence_branch_code',
  orgName: 'presence_org_name',
  branchName: 'presence_branch_name',
};

export type AppSettings = {
  apiUrl: string;
  token: string;
  deviceId: string;
  deviceName: string;
  branchCode: string;
  organizationName: string;
  branchName: string;
};

export async function loadSettings(): Promise<AppSettings> {
  const entries = await AsyncStorage.multiGet(Object.values(KEYS));
  const map = Object.fromEntries(entries);
  return {
    apiUrl: map[KEYS.apiUrl] || DEFAULT_API_URL,
    token: map[KEYS.token] || '',
    deviceId: map[KEYS.deviceId] || '',
    deviceName: map[KEYS.deviceName] || 'Presence Phone',
    branchCode: map[KEYS.branchCode] || 'HQ01',
    organizationName: map[KEYS.orgName] || 'Presence Demo Org',
    branchName: map[KEYS.branchName] || 'Sofoline',
  };
}

export async function saveSettings(partial: Partial<AppSettings>) {
  const pairs: [string, string][] = [];
  if (partial.apiUrl !== undefined) pairs.push([KEYS.apiUrl, partial.apiUrl]);
  if (partial.token !== undefined) pairs.push([KEYS.token, partial.token]);
  if (partial.deviceId !== undefined) pairs.push([KEYS.deviceId, partial.deviceId]);
  if (partial.deviceName !== undefined) pairs.push([KEYS.deviceName, partial.deviceName]);
  if (partial.branchCode !== undefined) pairs.push([KEYS.branchCode, partial.branchCode]);
  if (partial.organizationName !== undefined) pairs.push([KEYS.orgName, partial.organizationName]);
  if (partial.branchName !== undefined) pairs.push([KEYS.branchName, partial.branchName]);
  if (pairs.length) await AsyncStorage.multiSet(pairs);
}

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  message?: string;
};

async function request<T>(
  path: string,
  options: RequestInit & { token?: string; apiUrl?: string } = {},
): Promise<ApiResponse<T>> {
  const settings = await loadSettings();
  const base = (options.apiUrl || settings.apiUrl).replace(/\/$/, '');
  const token = options.token ?? settings.token;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${base}${path}`, {
    ...options,
    headers,
  });

  const json = (await res.json().catch(() => ({}))) as ApiResponse<T>;
  if (!res.ok && !json.message) {
    return { success: false, message: `HTTP ${res.status}` };
  }
  return json;
}

export async function login(email: string, password: string, apiUrl?: string) {
  return request<{ token: string; user: { fullName: string; role: string; email: string } }>(
    '/auth/login',
    {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      apiUrl,
      token: '',
    },
  );
}

export async function registerDevice(body: {
  deviceId: string;
  name: string;
  branchCode: string;
  platform: 'ANDROID' | 'IOS';
  model?: string;
  osVersion?: string;
}) {
  return request<{
    device: {
      deviceId: string;
      branch?: { code?: string; name?: string; organizationName?: string };
      kioskMode?: boolean;
    };
  }>('/devices/register', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function listEmployees(q = '') {
  const query = q ? `?q=${encodeURIComponent(q)}` : '';
  return request<{ users: Array<Record<string, unknown>> }>(`/employees${query}`);
}

export async function listAttendance() {
  return request<{ records: Array<Record<string, unknown>> }>('/attendance?limit=30');
}

export async function syncFaces() {
  return request<{
    syncedAt: string;
    users: Array<Record<string, unknown>>;
    branches: Array<Record<string, unknown>>;
  }>('/employees/sync');
}

export async function createAttendance(payload: {
  employeeId: string;
  deviceId: string;
  attendanceType: 'CLOCK_IN' | 'CLOCK_OUT';
  timestamp: string;
  faceScore?: number;
  branch?: string;
  clientEventId?: string;
}) {
  return request<{ attendance: Record<string, unknown> }>('/attendance', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
