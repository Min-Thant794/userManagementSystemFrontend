import { afterEach, describe, expect, it, vi } from 'vitest';
import { rawRequest, ApiError } from './http';
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
afterEach(() => vi.unstubAllGlobals());
describe('HTTP contract', () => {
  it('accepts 204 without parsing a body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
    );
    await expect(
      rawRequest('/api/auth/logout', { method: 'POST' }),
    ).resolves.toBeUndefined();
  });
  it('keeps validation fields and action extensions', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        json(
          {
            title: 'Validation Failed',
            detail: 'Invalid fields',
            errors: { email: 'Invalid email' },
            action: 'resend_verification',
          },
          400,
        ),
      ),
    );
    await expect(rawRequest('/api/auth/signup')).rejects.toMatchObject({
      status: 400,
      fieldErrors: { email: 'Invalid email' },
      action: 'resend_verification',
    });
  });
  it('handles HTML errors without rendering markup', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('<html>proxy failure</html>', {
          status: 502,
          headers: { 'Content-Type': 'text/html' },
        }),
      ),
    );
    await expect(rawRequest('/api/admin/users')).rejects.toMatchObject({
      status: 502,
      detail: 'The request could not be completed (502).',
    });
  });
  it('rejects a malformed successful page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(json({ content: [], totalElements: 0 })),
    );
    await expect(rawRequest('/api/admin/users')).rejects.toMatchObject({
      kind: 'contract',
    });
  });
  it('does not set a multipart content type and includes cookies', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetcher);
    const body = new FormData();
    body.append('file', new Blob(['image']), 'photo.png');
    await rawRequest(
      '/api/users/me/photo',
      { method: 'PUT', body },
      'test-token',
    );
    const options = fetcher.mock.calls[0][1] as RequestInit;
    expect(options.credentials).toBe('include');
    expect((options.headers as Headers).has('Content-Type')).toBe(false);
    expect((options.headers as Headers).get('Authorization')).toBe(
      'Bearer test-token',
    );
  });
  it('keeps cancellation distinct from a network failure', async () => {
    const controller = new AbortController();
    controller.abort();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError')),
    );
    await expect(
      rawRequest('/api/users/me', { signal: controller.signal }),
    ).rejects.not.toBeInstanceOf(ApiError);
  });
  it('uses the current 60-second rate-limit fallback', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({}, 429)));
    await expect(rawRequest('/api/auth/login')).rejects.toMatchObject({
      status: 429,
      retryAfterSeconds: 60,
    });
  });
});
