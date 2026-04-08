const API_BASE = import.meta.env.VITE_API_URL ?? '';

/** Thrown on non-OK responses; mirrors axios `error.response` for callers */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly response?: { status: number; data?: unknown },
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function buildUrl(
  path: string,
  params?: Record<string, string | number | boolean>,
): string {
  const root = API_BASE
    ? `${API_BASE.replace(/\/$/, '')}/api`
    : '/api';
  const url = new URL(
    `${root}${path}`,
    API_BASE ? undefined : window.location.origin,
  );
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function parseSuccessBody<T>(res: Response): Promise<T> {
  if (res.status === 204 || res.status === 205) {
    return undefined as T;
  }
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  params?: Record<string, string | number | boolean>,
  _retry = false,
): Promise<{ data: T }> {
  const url = buildUrl(path, params);
  const headers = new Headers({ 'Content-Type': 'application/json' });
  const token = localStorage.getItem('accessToken');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const init: RequestInit = {
    method,
    headers,
    ...(body !== undefined &&
    method !== 'GET' &&
    method !== 'HEAD' &&
    method !== 'DELETE'
      ? { body: JSON.stringify(body) }
      : {}),
  };

  let res = await fetch(url, init);

  if (res.status === 401 && !_retry) {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      localStorage.clear();
      window.location.href = '/login';
      throw new ApiError('Unauthorized', { status: 401 });
    }
    try {
      const refreshRes = await fetch(buildUrl('/auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!refreshRes.ok) throw new Error('refresh failed');
      const tokens = (await refreshRes.json()) as {
        accessToken: string;
        refreshToken: string;
      };
      localStorage.setItem('accessToken', tokens.accessToken);
      localStorage.setItem('refreshToken', tokens.refreshToken);
      return request<T>(method, path, body, params, true);
    } catch {
      localStorage.clear();
      window.location.href = '/login';
      throw new ApiError('Unauthorized', { status: 401 });
    }
  }

  if (!res.ok) {
    let data: unknown;
    try {
      data = await res.json();
    } catch {
      data = undefined;
    }
    throw new ApiError(`HTTP ${res.status}`, { status: res.status, data });
  }

  const data = await parseSuccessBody<T>(res);
  return { data };
}

export const api = {
  get: <T>(
    path: string,
    config?: { params?: Record<string, string | number | boolean> },
  ) => request<T>('GET', path, undefined, config?.params),

  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),

  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),

  delete: <T = void>(path: string) => request<T>('DELETE', path),
};
