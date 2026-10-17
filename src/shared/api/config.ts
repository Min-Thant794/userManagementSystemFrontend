export function validateApiOrigin(value: string, production: boolean): string {
  if (value === '') return '';
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(
      'VITE_API_BASE_URL must be an HTTP(S) origin, or empty for a same-origin proxy.',
    );
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw new Error(
      'VITE_API_BASE_URL must contain only an origin, without credentials or an API path.',
    );
  if (
    production &&
    (url.protocol !== 'https:' ||
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
  )
    throw new Error(
      'Production API must use HTTPS and a non-local hostname, or an empty same-origin base.',
    );
  return url.origin;
}
