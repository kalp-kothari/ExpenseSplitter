const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Shared HTTP boundary for the OPUSOL API. Endpoint contracts are proposals
 * until the backend owner confirms them; demo mode must never use this client.
 */
export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!API_BASE_URL) throw new ApiError('API is not configured. Set VITE_API_BASE_URL.');
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`, {
      ...init,
      credentials: 'include',
      headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
    });
  } catch {
    throw new ApiError('Could not reach the OPUSOL API. Check the connection and try again.');
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string; error?: string } | null;
    throw new ApiError(body?.message ?? body?.error ?? `The API returned ${response.status}.`, response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const apiConfig = { baseUrl: API_BASE_URL };
