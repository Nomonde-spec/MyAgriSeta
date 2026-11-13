import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const defaultApiBaseUrl = 'http://localhost:3000/api';
const loopbackHosts = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

function getExpoDevelopmentHost(): string | null {
  const hostUri = Constants.expoConfig?.hostUri;
  if (!hostUri) return null;

  try {
    const host = new URL(`http://${hostUri}`).hostname;
    return loopbackHosts.has(host) ? null : host;
  } catch {
    return null;
  }
}

function getApiBaseUrl(): string {
  const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.trim() || defaultApiBaseUrl;
  if (Platform.OS === 'web') return configuredUrl;

  try {
    const url = new URL(configuredUrl);
    if (loopbackHosts.has(url.hostname)) {
      const developmentHost = getExpoDevelopmentHost();
      if (developmentHost) url.hostname = developmentHost;
    }
    return url.toString().replace(/\/$/, '');
  } catch {
    return configuredUrl;
  }
}

export const API_BASE_URL = getApiBaseUrl();
const TOKEN_KEY = 'myagriseta_token';

function getWebSessionStorage(): Storage | null {
  return typeof window === 'undefined' ? null : window.sessionStorage;
}

export class ApiError extends Error {
  status: number;
  payload?: Record<string, unknown>;

  constructor(status: number, message: string, payload?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

export async function getStoredToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return getWebSessionStorage()?.getItem(TOKEN_KEY) ?? null;
  }

  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function saveStoredToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    const storage = getWebSessionStorage();
    if (!storage) {
      throw new Error('Browser session storage is unavailable.');
    }
    storage.setItem(TOKEN_KEY, token);
    return;
  }

  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearStoredToken(): Promise<void> {
  if (Platform.OS === 'web') {
    getWebSessionStorage()?.removeItem(TOKEN_KEY);
    return;
  }

  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getStoredToken();

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    });
  } catch {
    const connectionHint = Platform.OS === 'web'
      ? 'Check that the backend is running and reachable.'
      : 'Check that your phone and computer are on the same Wi-Fi, the backend is running, and the computer firewall allows port 3000.';
    throw new Error(`Could not connect to MyAgriSETA. ${connectionHint}`);
  }

  const rawBody = await response.text();
  const payload = rawBody ? JSON.parse(rawBody) : {};

  if (!response.ok) {
    throw new ApiError(
      response.status,
      typeof payload?.message === 'string' ? payload.message : 'Request failed.',
      payload as Record<string, unknown>
    );
  }

  return payload as T;
}
