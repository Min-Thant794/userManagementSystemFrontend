import type { BrowserContext, Route } from '@playwright/test';
export const adminId = '11111111-1111-4111-8111-111111111111';
export const memberId = '22222222-2222-4222-8222-222222222222';
export const admin = {
  id: adminId,
  username: 'min_admin',
  email: 'admin@example.test',
  phoneNumber: '+6591234567',
  role: 'ADMIN',
  status: 'ACTIVE',
  emailVerified: true,
  failedLoginAttempts: 0,
  lockedUntil: null,
  profileComplete: true,
  profileImageUrl: null,
  createdAt: '2026-10-01T09:00:00Z',
  updatedAt: '2026-10-15T09:00:00Z',
};
export const member = {
  ...admin,
  id: memberId,
  username: 'alex_chen',
  email: 'alex@example.test',
  role: 'USER',
};
export async function mockApi(
  context: BrowserContext,
  options: {
    signedIn?: boolean;
    role?: 'ADMIN' | 'USER';
    incomplete?: boolean;
  } = {},
) {
  const state = {
    signedIn: options.signedIn ?? false,
    role: options.role ?? 'ADMIN',
    incomplete: options.incomplete ?? false,
    version: 0,
    refreshes: 0,
    adminReads: 0,
    deniedAdminRequests: 0,
    meReads: 0,
    verificationCalls: 0,
    signup: null as Record<string, string> | null,
    pendingEmail: null as string | null,
    failLogout: false,
    blockRefresh: null as Promise<void> | null,
  };
  const users = [{ ...admin }, { ...member }];
  const signedInUser = options.role === 'USER' ? users[1] : users[0];
  const reply = (route: Route, status: number, body?: unknown) =>
    route.fulfill({
      status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': 'http://localhost:5173',
        'Access-Control-Allow-Credentials': 'true',
      },
      ...(status === 204 ? {} : { body: JSON.stringify(body ?? {}) }),
    });
  await context.route('http://localhost:8080/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    if (method === 'OPTIONS')
      return route.fulfill({
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': 'http://localhost:5173',
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type',
          'Access-Control-Allow-Methods':
            'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        },
      });
    const data = () => request.postDataJSON() as Record<string, string>;
    const fail = (status: number, detail: string, extra = {}) =>
      reply(route, status, {
        status,
        title: status === 401 ? 'Authentication Failed' : 'Request failed',
        detail,
        ...extra,
      });
    if (path === '/api/auth/refresh') {
      state.refreshes++;
      if (state.blockRefresh) await state.blockRefresh;
      if (!state.signedIn) return fail(400, 'Missing cookie');
      state.version++;
      return reply(route, 200, {
        accessToken: `token-${state.version}`,
        tokenType: 'Bearer',
        expiresIn: 900,
      });
    }
    if (path === '/api/auth/login') {
      if (data().password !== 'password123')
        return fail(401, 'Invalid credentials');
      state.signedIn = true;
      state.version++;
      return reply(route, 200, {
        accessToken: `token-${state.version}`,
        tokenType: 'Bearer',
        expiresIn: 900,
      });
    }
    if (path === '/api/auth/logout') {
      if (state.failLogout) return route.abort('failed');
      state.signedIn = false;
      return reply(route, 204);
    }
    if (path === '/api/auth/signup') {
      state.signup = data();
      return reply(route, 201, { ...member, pendingEmail: null });
    }
    if (path === '/api/auth/verify-email') {
      state.verificationCalls++;
      return data().token === 'expired'
        ? fail(401, 'Verification link expired')
        : reply(route, 204);
    }
    if (
      [
        '/api/auth/reset-password',
        '/api/auth/resend-verification',
        '/api/auth/forgot-password',
      ].includes(path)
    )
      return reply(route, 204);
    if (request.headers().authorization !== `Bearer token-${state.version}`)
      return fail(401, 'Expired access token');
    const current = {
      ...signedInUser,
      role: state.role,
      pendingEmail: state.pendingEmail,
    };
    if (path === '/api/users/me') {
      state.meReads++;
      if (state.incomplete)
        return fail(403, 'Complete your profile', {
          action: 'complete_profile',
        });
      if (method === 'PATCH') {
        if (data().email) state.pendingEmail = data().email;
        return reply(route, 200, {
          ...current,
          ...(data().username ? { username: data().username } : {}),
          pendingEmail: state.pendingEmail,
        });
      }
      return reply(route, 200, current);
    }
    if (path === '/api/users/me/complete-profile') {
      state.incomplete = false;
      return reply(route, 200, { ...current, ...data() });
    }
    if (path === '/api/users/me/password') {
      return data().currentPassword === 'wrong'
        ? fail(401, 'Current password is incorrect')
        : reply(route, 204);
    }
    if (path === '/api/users/me/password/initial') return reply(route, 204);
    if (path === '/api/auth/sessions') {
      return reply(route, 200, [
        {
          id: 7,
          device: 'Chrome on this computer',
          location: 'Local network',
          createdAt: '2026-10-17T01:00:00Z',
          lastUsedAt: '2026-10-17T02:00:00Z',
          current: true,
        },
        {
          id: 8,
          device: 'Safari on phone',
          location: 'Singapore',
          createdAt: '2026-10-15T01:00:00Z',
          lastUsedAt: '2026-10-16T02:00:00Z',
          current: false,
        },
      ]);
    }
    if (path.startsWith('/api/auth/sessions/')) return reply(route, 204);
    if (path.startsWith('/api/admin/')) {
      state.adminReads++;
      if (state.role !== 'ADMIN') {
        state.deniedAdminRequests++;
        return fail(403, 'Forbidden');
      }
    }
    const page = (items: unknown[]) => {
      const size = Number(url.searchParams.get('size') ?? 10);
      const number = Number(url.searchParams.get('page') ?? 0);
      return {
        content: items.slice(number * size, number * size + size),
        page: {
          size,
          number,
          totalElements: items.length,
          totalPages: Math.ceil(items.length / size),
        },
      };
    };
    if (path === '/api/admin/users' && method === 'GET') {
      let filtered = users;
      const search = url.searchParams.get('search');
      if (search)
        filtered = filtered.filter((user) =>
          (user.username + ' ' + user.email).includes(search),
        );
      for (const key of ['role', 'status'] as const) {
        const value = url.searchParams.get(key);
        if (value) filtered = filtered.filter((user) => user[key] === value);
      }
      return reply(route, 200, page(filtered));
    }
    if (path === '/api/admin/users' && method === 'POST') {
      const next = {
        ...admin,
        ...data(),
        id: '33333333-3333-4333-8333-333333333333',
      };
      users.push(next);
      return reply(route, 201, next);
    }
    if (path === '/api/admin/audit-logs')
      return reply(
        route,
        200,
        page([
          {
            id: 1,
            actorUserId: adminId,
            targetUserId: memberId,
            action: 'UPDATE',
            details: {
              before: { username: 'alex' },
              after: { username: 'alex_chen' },
            },
            createdAt: '2026-10-16T10:30:00Z',
          },
        ]),
      );
    const match = path.match(
      /^\/api\/admin\/users\/([^/]+)(?:\/(role|status))?$/,
    );
    if (match) {
      const user = users.find((user) => user.id === match[1]);
      if (!user) return fail(404, 'Account not found');
      if (method === 'PUT') {
        if (data().username === 'duplicate')
          return fail(409, 'Username already exists');
        Object.assign(
          user,
          Object.fromEntries(
            Object.entries(data()).filter(([key]) => key !== 'email'),
          ),
        );
      }
      if (method === 'PATCH') {
        Object.assign(user, data());
        if (user.id === signedInUser.id && data().role)
          state.role = data().role as 'USER' | 'ADMIN';
      }
      return reply(route, 200, user);
    }
    return fail(404, 'Fixture endpoint not defined');
  });
  return state;
}
