import type { Role } from '../api/types';
export function safeReturnPath(value: string | null, role: Role) {
  const fallback = role === 'ADMIN' ? '/admin' : '/account';
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    [...value].some((character) => character.charCodeAt(0) < 32)
  )
    return fallback;
  let url: URL;
  try {
    url = new URL(value, 'https://workspace.invalid');
  } catch {
    return fallback;
  }
  if (url.origin !== 'https://workspace.invalid') return fallback;
  const allowed =
    /^\/account(?:\/|$)/.test(url.pathname) ||
    (role === 'ADMIN' && /^\/admin(?:\/|$)/.test(url.pathname));
  return allowed ? `${url.pathname}${url.search}${url.hash}` : fallback;
}
