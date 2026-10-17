import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockApi, adminId, memberId } from './fixtures';
test('administrator login, search, detail and logout', async ({
  page,
  context,
}) => {
  await mockApi(context);
  await page.goto('/login');
  await page.getByLabel('Email or username').fill('min_admin');
  await page.getByLabel('Password', { exact: true }).fill('password123');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Good to see you, min_admin.' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'User directory' }).click();
  await page.getByLabel('Search users').fill('alex');
  await expect(
    page.getByRole('link', { name: 'alex_chen', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'min_admin', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('link', { name: 'alex_chen', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Access & permissions' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Welcome back' }),
  ).toBeVisible();
});
test('member cannot load administrator data on a deep link', async ({
  page,
  context,
}) => {
  const state = await mockApi(context, { signedIn: true, role: 'USER' });
  await page.goto('/admin/users');
  await expect(
    page.getByRole('heading', {
      name: 'You don’t have access to this workspace',
    }),
  ).toBeVisible();
  expect(state.adminReads).toBe(0);
});
test('cookie bootstrap restores a protected page on reload', async ({
  page,
  context,
}) => {
  await mockApi(context, { signedIn: true });
  await page.goto(`/admin/users/${memberId}`);
  await expect(
    page.getByRole('heading', { level: 1, name: 'alex_chen', exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { level: 1, name: 'alex_chen', exact: true }),
  ).toBeVisible();
});
test('wrong current password stays local and never triggers refresh', async ({
  page,
  context,
}) => {
  const state = await mockApi(context, { signedIn: true, role: 'USER' });
  await page.goto('/account/security');
  await expect(
    page.getByRole('heading', { name: 'Change password', exact: true }),
  ).toBeVisible();
  const baseline = state.refreshes;
  await page.getByLabel('Current password', { exact: true }).fill('wrong');
  await page.getByLabel('New password', { exact: true }).fill('newpassword123');
  await page.getByLabel('Confirm new password').fill('newpassword123');
  await page
    .getByRole('button', { name: 'Change password', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText(
    'Current password is incorrect',
  );
  expect(state.refreshes).toBe(baseline);
  await expect(
    page.getByLabel('Current password', { exact: true }),
  ).toHaveValue('wrong');
});
test('email verification scrubs its token and requires explicit submission', async ({
  page,
  context,
}) => {
  const state = await mockApi(context);
  await page.goto('/verify-email?token=expired');
  await expect(page).toHaveURL(/\/verify-email$/);
  expect(state.verificationCalls).toBe(0);
  const before = state.refreshes;
  await page.getByRole('button', { name: 'Verify email', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(
    'Verification link expired',
  );
  expect(state.refreshes).toBe(before);
});
test('incomplete account resolves to onboarding without a redirect loop', async ({
  page,
  context,
}) => {
  await mockApi(context, { signedIn: true, incomplete: true });
  await page.goto('/account');
  await expect(
    page.getByRole('heading', { name: 'Make this account yours' }),
  ).toBeVisible();
  await page.getByLabel('Username', { exact: true }).fill('new_member');
  await page.getByLabel('Phone number').fill('+6598765432');
  await page.getByRole('button', { name: 'Complete profile' }).click();
  await expect(page).toHaveURL(/\/admin$/);
});
test('self-demotion removes the administrator workspace', async ({
  page,
  context,
}) => {
  const state = await mockApi(context, { signedIn: true });
  await page.goto(`/admin/users/${adminId}`);
  await page.getByRole('button', { name: 'Change to member' }).click();
  await page.getByRole('button', { name: 'Confirm change' }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(
    page.getByRole('heading', { name: 'Welcome, min_admin.', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'User directory' })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole('link', { name: 'Admin workspace', exact: true }),
  ).toHaveCount(0);
  expect(state.deniedAdminRequests).toBe(0);
});
test('pending email remains separate from the current email', async ({
  page,
  context,
}) => {
  await mockApi(context, { signedIn: true, role: 'USER' });
  await page.goto('/account/email');
  await page.getByLabel('New email address').fill('new@example.test');
  await page.getByRole('button', { name: 'Send verification link' }).click();
  await expect(
    page.locator('dd').filter({ hasText: 'alex@example.test' }),
  ).toBeVisible();
  await expect(
    page.locator('dd').filter({ hasText: 'new@example.test' }),
  ).toBeVisible();
});
test('duplicate profile validation retains the draft', async ({
  page,
  context,
}) => {
  await mockApi(context, { signedIn: true });
  await page.goto(`/admin/users/${memberId}/edit`);
  await page.getByLabel('Username', { exact: true }).fill('duplicate');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('alert')).toContainText(
    'Username already exists',
  );
  await expect(page.getByLabel('Username', { exact: true })).toHaveValue(
    'duplicate',
  );
});
test('mobile layout and critical accessibility checks', async ({
  page,
  context,
}) => {
  await mockApi(context, { signedIn: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/admin');
  await expect(
    page.getByRole('heading', { name: /Good to see you/ }),
  ).toBeVisible();
  const violations = (
    await new AxeBuilder({ page }).analyze()
  ).violations.filter((item) =>
    ['serious', 'critical'].includes(item.impact ?? ''),
  );
  expect(violations).toEqual([]);
  await page.setViewportSize({ width: 320, height: 800 });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('link', { name: 'User directory' }).click();
  await expect(
    page.getByRole('heading', { name: 'User directory' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'min_admin', exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test('sign-out propagates to a second tab', async ({ page, context }) => {
  await mockApi(context, { signedIn: true });
  await page.goto('/account');
  await expect(page.getByRole('heading', { name: /Welcome,/ })).toBeVisible();
  const second = await context.newPage();
  await second.goto('/account');
  await expect(second.getByRole('heading', { name: /Welcome,/ })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(
    second.getByRole('heading', { name: 'Welcome back' }),
  ).toBeVisible();
});
test('ten concurrent expired reads share one refresh', async ({
  page,
  context,
}) => {
  const state = await mockApi(context, { signedIn: true });
  await page.goto('/account');
  await expect(page.getByRole('heading', { name: /Welcome,/ })).toBeVisible();
  const before = state.refreshes;
  state.version++;
  await page.evaluate(async () => {
    const modulePath = '/src/shared/api/client.ts';
    const { api } = (await import(modulePath)) as {
      api: (path: string) => Promise<unknown>;
    };
    await Promise.all(Array.from({ length: 10 }, () => api('/api/users/me')));
  });
  expect(state.refreshes - before).toBe(1);
});
test('two tabs share one refresh after simultaneous expiry', async ({
  page,
  context,
}) => {
  const state = await mockApi(context, { signedIn: true });
  await page.goto('/account');
  await expect(page.getByRole('heading', { name: /Welcome,/ })).toBeVisible();
  const second = await context.newPage();
  await second.goto('/account');
  await expect(second.getByRole('heading', { name: /Welcome,/ })).toBeVisible();
  const before = state.refreshes;
  state.version++;
  await Promise.all(
    [page, second].map((tab) =>
      tab.evaluate(async () => {
        const modulePath = '/src/shared/api/client.ts';
        const { api } = (await import(modulePath)) as {
          api: (path: string) => Promise<unknown>;
        };
        await api('/api/users/me');
      }),
    ),
  );
  expect(state.refreshes - before).toBe(1);
});
