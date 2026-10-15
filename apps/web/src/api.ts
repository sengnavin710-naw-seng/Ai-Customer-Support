import type {
  Article,
  ArticleInput,
  ArticleVersion,
  AuditRecord,
  Category,
  Dashboard,
  Health,
  Page,
  Session,
} from '@support/contracts';
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
    let message =
      response.status === 401
        ? 'Invalid credentials or expired session. Please sign in again.'
        : response.status === 429
          ? 'Too many requests. Please try again in a minute.'
          : response.status === 403
            ? 'Your role cannot access this workspace.'
            : 'The request could not be completed. Please try again.';
    if ([400, 404, 409, 503].includes(response.status)) {
      const details: unknown = await response.json().catch(() => null);
      if (details && typeof details === 'object' && 'message' in details) {
        if (typeof details.message === 'string') message = details.message;
        else if (
          Array.isArray(details.message) &&
          details.message.every((item) => typeof item === 'string')
        )
          message = details.message.join('. ');
      }
    }
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
const kb = '/knowledge-base';
const options = (token: string, method = 'GET', body?: unknown): RequestInit => ({
  method,
  headers: bearer(token),
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
export const knowledgeApi = {
  categories: (token: string, query = '') =>
    request<Page<Category>>(`${kb}/categories?${query}`, options(token)),
  createCategory: (token: string, body: { name: string; description: string }) =>
    request<Category>(`${kb}/categories`, options(token, 'POST', body)),
  updateCategory: (
    token: string,
    id: string,
    body: { name: string; description: string; expectedRevision: number },
  ) => request<Category>(`${kb}/categories/${id}`, options(token, 'PATCH', body)),
  deleteCategory: (token: string, id: string, expectedRevision: number) =>
    request<void>(`${kb}/categories/${id}`, options(token, 'DELETE', { expectedRevision })),
  articles: (token: string, query = '') =>
    request<Page<Article>>(`${kb}/articles?${query}`, options(token)),
  article: (token: string, id: string) => request<Article>(`${kb}/articles/${id}`, options(token)),
  createArticle: (token: string, body: ArticleInput) =>
    request<Article>(`${kb}/articles`, options(token, 'POST', body)),
  updateArticle: (token: string, id: string, body: ArticleInput & { expectedRevision: number }) =>
    request<Article>(`${kb}/articles/${id}`, options(token, 'PATCH', body)),
  submit: (token: string, id: string, expectedRevision: number) =>
    request<Article>(`${kb}/articles/${id}/submit`, options(token, 'POST', { expectedRevision })),
  review: (
    token: string,
    id: string,
    expectedRevision: number,
    decision: 'approve' | 'reject',
    note: string,
  ) =>
    request<Article>(
      `${kb}/articles/${id}/review`,
      options(token, 'POST', { expectedRevision, decision, note }),
    ),
  archive: (token: string, id: string, expectedRevision: number) =>
    request<void>(`${kb}/articles/${id}`, options(token, 'DELETE', { expectedRevision })),
  versions: (token: string, id: string, page = 1) =>
    request<Page<ArticleVersion>>(
      `${kb}/articles/${id}/versions?page=${page}&limit=5`,
      options(token),
    ),
  audit: (token: string, id: string, page = 1) =>
    request<Page<AuditRecord>>(
      `${kb}/audit-records?entityId=${id}&page=${page}&limit=10`,
      options(token),
    ),
};
