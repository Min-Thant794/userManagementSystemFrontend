import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  peek: vi.fn(),
  valid: vi.fn(),
  refresh: vi.fn(),
  clear: vi.fn(),
  rawRequest: vi.fn(),
}));
vi.mock('../auth/session', () => ({ session: { version: 0, ...mocks } }));
vi.mock('./http', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./http')>()),
  rawRequest: mocks.rawRequest,
}));
import { api, ApiError } from './client';
beforeEach(() => {
  vi.clearAllMocks();
  mocks.valid.mockReturnValue(true);
  mocks.peek.mockReturnValue('old');
  mocks.refresh.mockResolvedValue('new');
});
describe('authentication recovery policy', () => {
  it('refreshes once and replays a protected read', async () => {
    mocks.rawRequest
      .mockRejectedValueOnce(new ApiError(401, 'Unauthorized', 'Expired'))
      .mockResolvedValueOnce({ id: 'ok' });
    await expect(api('/api/users/me')).resolves.toEqual({ id: 'ok' });
    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(mocks.rawRequest).toHaveBeenCalledTimes(2);
  });
  it('does not replay a wrong-password mutation', async () => {
    mocks.rawRequest.mockRejectedValue(
      new ApiError(401, 'Authentication Failed', 'Wrong current password'),
    );
    await expect(
      api('/api/users/me/password', {
        method: 'PUT',
        body: { currentPassword: 'wrong', newPassword: 'example123' },
      }),
    ).rejects.toMatchObject({ status: 401 });
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(mocks.rawRequest).toHaveBeenCalledOnce();
  });
  it('does not attach bearer or recover public requests', async () => {
    mocks.rawRequest.mockRejectedValue(
      new ApiError(401, 'Authentication Failed', 'Expired link'),
    );
    await expect(
      api('/api/auth/verify-email', {
        method: 'POST',
        auth: false,
        body: { token: 'test-link' },
      }),
    ).rejects.toMatchObject({ status: 401 });
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(mocks.rawRequest.mock.calls[0]).toHaveLength(2);
  });
});
