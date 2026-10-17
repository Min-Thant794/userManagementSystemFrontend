import { ApiError, rawRequest } from '../api/http';
import { tokensSchema, type AuthTokens } from '../api/types';
type Credential = { token: string; expiresAt: number; startedAt: number };
type SessionEvent =
  { type: 'clear'; message?: string } | { type: 'login'; external: boolean };
export class SessionCoordinator {
  private credential: Credential | null = null;
  private pending: Promise<string> | null = null;
  private channel: BroadcastChannel | null = null;
  private cutoff = 0;
  private listeners = new Set<(event: SessionEvent) => void>();
  version = 0;
  invalidateWork() {
    this.version += 1;
  }
  constructor() {
    if (
      typeof window !== 'undefined' &&
      typeof BroadcastChannel !== 'undefined'
    ) {
      this.channel = new BroadcastChannel('ums-session-v1');
      this.channel.onmessage = ({ data }: MessageEvent<unknown>) => {
        if (!data || typeof data !== 'object') return;
        const message = data as Record<string, unknown>;
        if (message.type === 'clear' && typeof message.at === 'number')
          this.clear(undefined, false, message.at);
        if (message.type === 'request' && this.valid() && this.credential)
          this.channel?.postMessage({
            type: 'token',
            ...this.credential,
            reason: 'refresh',
          });
        if (
          message.type === 'token' &&
          typeof message.token === 'string' &&
          typeof message.expiresAt === 'number' &&
          typeof message.startedAt === 'number' &&
          message.startedAt > this.cutoff &&
          message.expiresAt > Date.now()
        ) {
          this.credential = {
            token: message.token,
            expiresAt: message.expiresAt,
            startedAt: message.startedAt,
          };
          if (message.reason === 'login')
            this.emit({ type: 'login', external: true });
        }
      };
    }
  }
  subscribe(listener: (event: SessionEvent) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  private emit(event: SessionEvent) {
    this.listeners.forEach((fn) => fn(event));
  }
  valid() {
    return Boolean(
      this.credential && this.credential.expiresAt > Date.now() + 15_000,
    );
  }
  peek() {
    return this.credential?.token;
  }
  clear(message?: string, broadcast = true, at = Date.now()) {
    this.version += 1;
    this.cutoff = Math.max(this.cutoff, at);
    this.credential = null;
    this.emit({ type: 'clear', message });
    if (broadcast) this.channel?.postMessage({ type: 'clear', at });
  }
  private async locked<T>(work: () => Promise<T>): Promise<T> {
    if (typeof navigator === 'undefined' || !navigator.locks || !this.channel)
      throw new ApiError(
        0,
        'Browser support required',
        'Use a current browser with Web Locks and BroadcastChannel support to sign in safely across tabs.',
        {},
        undefined,
        undefined,
        'network',
      );
    return navigator.locks.request('ums-session-cookie-v1', work);
  }
  private set(
    tokens: AuthTokens,
    startedAt: number,
    reason: 'login' | 'refresh',
  ) {
    this.credential = {
      token: tokens.accessToken,
      expiresAt: Date.now() + tokens.expiresIn * 1000,
      startedAt,
    };
    this.channel?.postMessage({ type: 'token', ...this.credential, reason });
  }
  async login(identifier: string, password: string) {
    this.clear();
    const version = this.version;
    await this.locked(async () => {
      if (version !== this.version)
        throw new DOMException('Session changed', 'AbortError');
      const startedAt = Math.max(Date.now(), this.cutoff + 1);
      const data = await rawRequest<AuthTokens>('/api/auth/login', {
        method: 'POST',
        body: { identifier, password },
        auth: false,
      });
      if (version !== this.version)
        throw new DOMException('Session changed', 'AbortError');
      this.set(data, startedAt, 'login');
    });
  }
  refresh(rejectedToken?: string): Promise<string> {
    if (this.valid() && (!rejectedToken || rejectedToken !== this.peek()))
      return Promise.resolve(this.peek()!);
    if (this.pending) return this.pending;
    const version = this.version;
    const operation = this.locked(async () => {
      if (version !== this.version)
        throw new DOMException('Session changed', 'AbortError');
      // Ask an already-open tab for its in-memory credential after acquiring the cookie lock.
      this.channel?.postMessage({ type: 'request' });
      await new Promise((resolve) => setTimeout(resolve, 60));
      if (version !== this.version)
        throw new DOMException('Session changed', 'AbortError');
      if (this.valid() && (!rejectedToken || rejectedToken !== this.peek()))
        return this.peek()!;
      const startedAt = Math.max(Date.now(), this.cutoff + 1);
      const data = await rawRequest<AuthTokens>('/api/auth/refresh', {
        method: 'POST',
        auth: false,
      });
      tokensSchema.parse(data);
      if (version !== this.version)
        throw new DOMException('Session changed', 'AbortError');
      this.set(data, startedAt, 'refresh');
      return data.accessToken;
    })
      .catch((error) => {
        if (
          version === this.version &&
          error instanceof ApiError &&
          [400, 401, 403].includes(error.status)
        )
          this.clear(error.status === 403 ? error.message : undefined);
        throw error;
      })
      .finally(() => {
        if (this.pending === operation) this.pending = null;
      });
    this.pending = operation;
    return operation;
  }
  async logout() {
    this.clear();
    await this.locked(() =>
      rawRequest<void>('/api/auth/logout', { method: 'POST', auth: false }),
    );
  }
}
export const session = new SessionCoordinator();
