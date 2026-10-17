import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext, type AuthContextValue } from '../shared/auth/useAuth';
import { AdminOverview } from './admin/AdminPages';
import { AccountEmail, AccountSecurity } from './account/AccountPages';
import { VerifyEmail } from './auth/AuthPages';
const mock = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock('../shared/api/client', async (original) => ({
  ...(await original<typeof import('../shared/api/client')>()),
  api: mock.api,
}));
import { ApiError } from '../shared/api/client';
const account = {
  id: '11111111-1111-4111-8111-111111111111',
  username: 'member',
  email: 'current@example.test',
  pendingEmail: 'pending@example.test',
  phoneNumber: '+6591234567',
  role: 'USER' as const,
  profileImageUrl: null,
};
const auth: AuthContextValue = {
  status: 'authenticated',
  user: account,
  epoch: 1,
  error: null,
  login: vi.fn(),
  logout: vi.fn(),
  reloadUser: vi.fn(),
  retrySession: vi.fn(),
  clearSession: vi.fn(),
};
function renderPage(element: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const router = createMemoryRouter([{ path: '*', element }]);
  render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>
        <RouterProvider router={router} />
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
  return userEvent.setup();
}
afterEach(cleanup);
beforeEach(() => {
  mock.api.mockReset();
  vi.clearAllMocks();
});
describe('workspace screen contracts', () => {
  it('uses nested server totals instead of visible page length', async () => {
    mock.api.mockImplementation((path: string) =>
      Promise.resolve({
        content: [],
        page: {
          size: 1,
          number: 0,
          totalElements: path.includes('status=ACTIVE')
            ? 30
            : path.includes('status=SUSPENDED')
              ? 12
              : path.includes('audit-logs')
                ? 0
                : 42,
          totalPages: 42,
        },
      }),
    );
    renderPage(<AdminOverview />);
    expect(await screen.findByText('42')).toBeVisible();
    expect(await screen.findByText('30')).toBeVisible();
    expect(await screen.findByText('12')).toBeVisible();
  });
  it('shows pending and current email separately', () => {
    renderPage(<AccountEmail />);
    expect(
      screen.getByText('current@example.test', { exact: true }),
    ).toBeVisible();
    expect(
      screen.getByText('pending@example.test', { exact: true }),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: /resend/i }),
    ).not.toBeInTheDocument();
  });
  it('keeps a wrong current password on the form and does not clear auth', async () => {
    mock.api.mockRejectedValue(
      new ApiError(401, 'Authentication Failed', 'Wrong current password'),
    );
    const user = renderPage(<AccountSecurity />);
    await user.type(
      screen.getByLabelText('Current password', { exact: true }),
      'wrong',
    );
    await user.type(
      screen.getByLabelText('New password', { exact: true }),
      'newpassword123',
    );
    await user.type(
      screen.getByLabelText('Confirm new password'),
      'newpassword123',
    );
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Wrong current password',
    );
    expect(auth.clearSession).not.toHaveBeenCalled();
    expect(mock.api).toHaveBeenCalledWith('/api/users/me/password', {
      method: 'PUT',
      body: { currentPassword: 'wrong', newPassword: 'newpassword123' },
    });
  });
  it('consumes a verification link only after confirmation', async () => {
    window.history.replaceState(null, '', '/verify-email?token=example-link');
    mock.api.mockResolvedValue(undefined);
    const user = renderPage(<VerifyEmail />);
    expect(mock.api).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Verify email' }));
    expect(mock.api).toHaveBeenCalledWith('/api/auth/verify-email', {
      method: 'POST',
      auth: false,
      body: { token: 'example-link' },
    });
    expect(
      await screen.findByRole('heading', { name: 'Email verified' }),
    ).toBeVisible();
  });
});
