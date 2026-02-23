export const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';
export const AUTH_TOKEN_STORAGE_KEY = 'app_horario2_auth_token';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function getStoredToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
}

export function clearStoredToken(): void {
  localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
}

function parseErrorMessage(raw: string): string {
  if (!raw) return 'Error inesperado.';

  try {
    const parsed = JSON.parse(raw) as { error?: string };
    if (parsed?.error) {
      return parsed.error;
    }
  } catch {
    // Si no es JSON válido, devolvemos tal cual.
  }

  return raw;
}

export async function request<T>(path: string, init?: RequestInit, token?: string): Promise<T> {
  const resolvedToken = token ?? getStoredToken();
  const headers = new Headers(init?.headers ?? {});

  if (!headers.has('Content-Type') && init?.body) {
    headers.set('Content-Type', 'application/json');
  }

  if (resolvedToken) {
    headers.set('Authorization', `Bearer ${resolvedToken}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers
  });

  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(response.status, parseErrorMessage(text));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
