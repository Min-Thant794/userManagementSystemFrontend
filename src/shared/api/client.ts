import { session } from '../auth/session';
import { ApiError, rawRequest, type RequestOptions } from './http';
export { ApiError, API_BASE_URL } from './http';
let denied: ((error: ApiError, path: string) => void) | undefined;
export function onAccessIssue(
  handler: (error: ApiError, path: string) => void,
) {
  denied = handler;
}
export async function api<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  if (options.auth === false) return rawRequest<T>(path, options);
  const version = session.version;
  const token = session.valid() ? session.peek()! : await session.refresh();
  const execute = async (bearer: string) => {
    const data = await rawRequest<T>(path, options, bearer);
    if (version !== session.version)
      throw new DOMException('Session changed', 'AbortError');
    return data;
  };
  try {
    return await execute(token);
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.status === 401 &&
      (options.retry ??
        (options.method === undefined || options.method === 'GET'))
    ) {
      const next = await session.refresh(token);
      try {
        return await execute(next);
      } catch (retryError) {
        if (retryError instanceof ApiError && retryError.status === 401)
          session.clear('Your session ended. Please sign in again.');
        if (
          retryError instanceof ApiError &&
          retryError.status === 403 &&
          path !== '/api/users/me'
        )
          denied?.(retryError, path);
        throw retryError;
      }
    }
    if (
      error instanceof ApiError &&
      error.status === 403 &&
      path !== '/api/users/me'
    )
      denied?.(error, path);
    throw error;
  }
}
