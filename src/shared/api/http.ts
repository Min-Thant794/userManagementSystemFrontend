import { validateApiOrigin } from './config';
import {
  adminUserSchema,
  auditSchema,
  pageSchema,
  sessionSchema,
  tokensSchema,
  userSchema,
} from './types';
export const API_BASE_URL = validateApiOrigin(
  import.meta.env.VITE_API_BASE_URL ??
    (import.meta.env.PROD ? '' : 'http://localhost:8080'),
  import.meta.env.PROD,
);
export class ApiError extends Error {
  constructor(
    public status: number,
    public title: string,
    public detail: string,
    public fieldErrors: Record<string, string> = {},
    public action?: string,
    public retryAfterSeconds?: number,
    public kind: 'http' | 'network' | 'timeout' | 'contract' = 'http',
  ) {
    super(detail);
    this.name = 'ApiError';
  }
}
export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  auth?: boolean;
  retry?: boolean;
};
function validate(path: string, method: string, data: unknown) {
  const route = path.split('?')[0];
  const schema =
    route === '/api/auth/login' || route === '/api/auth/refresh'
      ? tokensSchema
      : route === '/api/auth/sessions' && method === 'GET'
        ? sessionSchema.array()
        : route === '/api/admin/audit-logs'
          ? pageSchema(auditSchema)
          : route === '/api/admin/users' && method === 'GET'
            ? pageSchema(adminUserSchema)
            : route.startsWith('/api/admin/users')
              ? adminUserSchema
              : route.startsWith('/api/users/me') ||
                  route === '/api/auth/signup'
                ? userSchema
                : null;
  if (!schema) return data;
  const result = schema.safeParse(data);
  if (!result.success)
    throw new ApiError(
      0,
      'Unexpected response',
      'The server returned an unexpected format. Please try again or contact support.',
      {},
      undefined,
      undefined,
      'contract',
    );
  return result.data;
}
export async function rawRequest<T>(
  path: string,
  options: RequestOptions = {},
  token?: string,
): Promise<T> {
  const method = options.method ?? 'GET';
  const headers = new Headers({
    Accept: 'application/json, application/problem+json',
  });
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const multipart = options.body instanceof FormData;
  if (options.body !== undefined && !multipart)
    headers.set('Content-Type', 'application/json');
  const timeout = AbortSignal.timeout(20_000);
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeout])
    : timeout;
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      credentials: 'include',
      headers,
      body:
        options.body === undefined
          ? undefined
          : multipart
            ? (options.body as FormData)
            : JSON.stringify(options.body),
      signal,
    });
  } catch (error) {
    if (timeout.aborted && !options.signal?.aborted)
      throw new ApiError(
        0,
        'Request timed out',
        'The server took too long to respond. Please try again.',
        {},
        undefined,
        undefined,
        'timeout',
      );
    if (
      options.signal?.aborted ||
      (error instanceof DOMException && error.name === 'AbortError')
    )
      throw error;
    throw new ApiError(
      0,
      'Connection unavailable',
      'Could not reach the service. Check your connection and try again.',
      {},
      undefined,
      undefined,
      'network',
    );
  }
  if (response.status === 204) return undefined as T;
  const contentType = response.headers.get('content-type') ?? '';
  let body: unknown;
  if (contentType.includes('json')) {
    try {
      body = await response.json();
    } catch (error) {
      if (options.signal?.aborted) throw error;
      if (timeout.aborted)
        throw new ApiError(
          0,
          'Request timed out',
          'The response took too long to arrive.',
          {},
          undefined,
          undefined,
          'timeout',
        );
      body = undefined;
    }
  }
  if (!response.ok) {
    const record =
      body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const fields: Record<string, string> = {};
    if (record.errors && typeof record.errors === 'object')
      Object.entries(record.errors).forEach(([key, value]) => {
        if (typeof value === 'string') fields[key] = value;
      });
    const retryHeader = response.headers.get('Retry-After');
    const retry = retryHeader
      ? /^\d+$/.test(retryHeader)
        ? Number(retryHeader)
        : Math.max(0, Math.ceil((Date.parse(retryHeader) - Date.now()) / 1000))
      : 60;
    throw new ApiError(
      response.status,
      typeof record.title === 'string' ? record.title : 'Request failed',
      typeof record.detail === 'string'
        ? record.detail
        : response.status === 429
          ? 'Too many requests. Wait one minute and try again.'
          : `The request could not be completed (${response.status}).`,
      fields,
      typeof record.action === 'string' ? record.action : undefined,
      response.status === 429
        ? Number.isFinite(retry)
          ? retry
          : 60
        : undefined,
    );
  }
  return validate(path, method, body) as T;
}
