import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('../api/http', async (original) => ({
  ...(await original<typeof import('../api/http')>()),
  rawRequest: mock.request,
}));
import { SessionCoordinator } from './session';
class Channel {
  static channels: Channel[] = [];
  onmessage: ((event: { data: unknown }) => void) | null = null;
  constructor() {
    Channel.channels.push(this);
  }
  postMessage(data: unknown) {
    for (const peer of Channel.channels)
      if (peer !== this) queueMicrotask(() => peer.onmessage?.({ data }));
  }
}
let queue: Promise<unknown>;
beforeEach(() => {
  Channel.channels = [];
  queue = Promise.resolve();
  mock.request.mockReset();
  vi.stubGlobal('BroadcastChannel', Channel);
  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: {
      request: (_name: string, work: () => Promise<unknown>) => {
        const task = queue.then(work);
        queue = task.catch(() => {});
        return task;
      },
    },
  });
});
afterEach(() => vi.unstubAllGlobals());
const tokens = {
  accessToken: 'test-token',
  tokenType: 'Bearer',
  expiresIn: 900,
};
describe('rotating refresh coordination', () => {
  it('shares one refresh among ten concurrent callers', async () => {
    mock.request.mockResolvedValue(tokens);
    const session = new SessionCoordinator();
    await Promise.all(Array.from({ length: 10 }, () => session.refresh()));
    expect(mock.request).toHaveBeenCalledOnce();
    expect(session.peek()).toBe('test-token');
  });
  it('shares an ephemeral token with a second tab under the cookie lock', async () => {
    mock.request.mockResolvedValue(tokens);
    const first = new SessionCoordinator();
    const second = new SessionCoordinator();
    await Promise.all([first.refresh(), second.refresh()]);
    expect(mock.request).toHaveBeenCalledOnce();
    expect(first.peek()).toBe(second.peek());
  });
  it('does not resurrect a credential when logout happens during refresh', async () => {
    let finish: (value: unknown) => void = () => {};
    let started: () => void = () => {};
    const waiting = new Promise<void>((resolve) => {
      started = resolve;
    });
    mock.request
      .mockImplementationOnce(() => {
        started();
        return new Promise((resolve) => {
          finish = resolve;
        });
      })
      .mockResolvedValueOnce(undefined);
    const session = new SessionCoordinator();
    const refreshing = session.refresh().catch((error) => error);
    await waiting;
    const logout = session.logout();
    finish(tokens);
    expect(await refreshing).toMatchObject({ name: 'AbortError' });
    await logout;
    expect(session.peek()).toBeUndefined();
    expect(mock.request.mock.calls[1][0]).toBe('/api/auth/logout');
  });
  it('clears all open tabs on logout', async () => {
    mock.request.mockResolvedValueOnce(tokens).mockResolvedValueOnce(undefined);
    const first = new SessionCoordinator();
    const second = new SessionCoordinator();
    await first.refresh();
    await Promise.resolve();
    expect(second.peek()).toBe('test-token');
    await first.logout();
    await Promise.resolve();
    expect(second.peek()).toBeUndefined();
  });
  it('never stores credentials in browser storage', async () => {
    const local = vi.spyOn(Storage.prototype, 'setItem');
    mock.request.mockResolvedValue(tokens);
    await new SessionCoordinator().refresh();
    expect(local).not.toHaveBeenCalled();
    local.mockRestore();
  });
});
