import type { Dashboard, Health, Session } from '@support/contracts';
const base = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${base}/api${path}`, {
      ...options,
      signal: options.signal ?? AbortSignal.timeout(8000),
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });
  } catch {
    throw new ApiError('Cannot reach the API. Check that the backend is running.', 0);
  }
  if (!response.ok) {
    const message =
      response.status === 401
        ? 'Invalid credentials or expired session. Please sign in again.'
        : response.status === 429
          ? 'Too many requests. Please try again in a minute.'
          : response.status === 403
            ? 'Your role cannot access this workspace.'
            : 'The request could not be completed. Please try again.';
    throw new ApiError(message, response.status);
  }
  return response.status === 204 ? (undefined as T) : (response.json() as Promise<T>);
}
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
export const api = {
  health: () => request<Health>('/health'),
  login: (email: string, password: string) =>
    request<Session>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: (token: string) =>
    request<void>('/auth/logout', { method: 'POST', headers: bearer(token) }),
  dashboard: (token: string) => request<Dashboard>('/dashboard', { headers: bearer(token) }),
};
