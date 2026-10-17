import { lazy, Suspense } from 'react';
import {
  createBrowserRouter,
  Link,
  Navigate,
  Outlet,
  useLocation,
  useRouteError,
  RouterProvider,
} from 'react-router';
import { useAuth } from '../shared/auth/useAuth';
import { Button, Card, ErrorState, LoadingState, Notice } from '../shared/ui';
import { WorkspaceLayout } from './WorkspaceLayout';
const auth = () => import('../features/auth/AuthPages');
const admin = () => import('../features/admin/AdminPages');
const account = () => import('../features/account/AccountPages');
const Login = lazy(() => auth().then((m) => ({ default: m.Login })));
const Signup = lazy(() => auth().then((m) => ({ default: m.Signup })));
const CheckEmail = lazy(() => auth().then((m) => ({ default: m.CheckEmail })));
const VerifyEmail = lazy(() =>
  auth().then((m) => ({ default: m.VerifyEmail })),
);
const ForgotPassword = lazy(() =>
  auth().then((m) => ({ default: m.ForgotPassword })),
);
const ResetPassword = lazy(() =>
  auth().then((m) => ({ default: m.ResetPassword })),
);
const OAuthCallback = lazy(() =>
  auth().then((m) => ({ default: m.OAuthCallback })),
);
const CompleteProfile = lazy(() =>
  auth().then((m) => ({ default: m.CompleteProfile })),
);
const AdminOverview = lazy(() =>
  admin().then((m) => ({ default: m.AdminOverview })),
);
const UserDirectory = lazy(() =>
  admin().then((m) => ({ default: m.UserDirectory })),
);
const UserDetail = lazy(() => admin().then((m) => ({ default: m.UserDetail })));
const UserEdit = lazy(() => admin().then((m) => ({ default: m.UserEdit })));
const CreateAdmin = lazy(() =>
  admin().then((m) => ({ default: m.CreateAdmin })),
);
const AuditLogs = lazy(() => admin().then((m) => ({ default: m.AuditLogs })));
const AccountHome = lazy(() =>
  account().then((m) => ({ default: m.AccountHome })),
);
const AccountProfile = lazy(() =>
  account().then((m) => ({ default: m.AccountProfile })),
);
const AccountEmail = lazy(() =>
  account().then((m) => ({ default: m.AccountEmail })),
);
const AccountSecurity = lazy(() =>
  account().then((m) => ({ default: m.AccountSecurity })),
);
const AccountSessions = lazy(() =>
  account().then((m) => ({ default: m.AccountSessions })),
);
function Root() {
  const location = useLocation();
  return (
    <Suspense fallback={<LoadingState label="Opening your workspace…" />}>
      <div key={location.pathname.split('/')[1]}>
        <Outlet />
      </div>
    </Suspense>
  );
}
function Protected({ adminOnly = false }: { adminOnly?: boolean }) {
  const auth = useAuth();
  const location = useLocation();
  if (auth.status === 'loading')
    return <LoadingState label="Restoring your session…" />;
  if (auth.status === 'unavailable')
    return (
      <div style={{ maxWidth: 600, margin: '80px auto', padding: 20 }}>
        <Card title="Could not restore your account">
          <div className="stack">
            <Notice tone="warning">{auth.error}</Notice>
            <Button onClick={() => void auth.retrySession()}>
              Retry connection
            </Button>
            <Link to="/login">Go to sign in</Link>
          </div>
        </Card>
      </div>
    );
  if (auth.status === 'incomplete')
    return <Navigate to="/complete-profile" replace />;
  if (auth.status !== 'authenticated')
    return (
      <Navigate
        to={`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    );
  if (adminOnly && auth.user?.role !== 'ADMIN')
    return <Navigate to="/forbidden" replace />;
  return <Outlet key={`${auth.epoch}-${auth.user?.id}`} />;
}
function Landing() {
  const auth = useAuth();
  if (auth.status === 'loading') return <LoadingState />;
  return (
    <Navigate
      to={
        auth.status === 'authenticated'
          ? auth.user?.role === 'ADMIN'
            ? '/admin'
            : '/account'
          : auth.status === 'incomplete'
            ? '/complete-profile'
            : '/login'
      }
      replace
    />
  );
}
function Missing({ forbidden = false }: { forbidden?: boolean }) {
  return (
    <main style={{ maxWidth: 600, margin: '80px auto', padding: 20 }}>
      <Card
        title={
          forbidden
            ? 'You don’t have access to this workspace'
            : 'Page not found'
        }
      >
        <p className="muted">
          {forbidden
            ? 'Administrator access is required to open this page.'
            : 'The page may have moved or the address may be incorrect.'}
        </p>
        <Link className="button-link" to="/">
          Return to my workspace
        </Link>
      </Card>
    </main>
  );
}
function RouteError() {
  const error = useRouteError();
  return (
    <main style={{ maxWidth: 600, margin: '80px auto', padding: 20 }}>
      <ErrorState error={error} />
      <p>
        <a href="/">Reload workspace</a>
      </p>
    </main>
  );
}
const router = createBrowserRouter([
  {
    element: <Root />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Landing /> },
      { path: 'login', element: <Login /> },
      { path: 'signup', element: <Signup /> },
      { path: 'check-email', element: <CheckEmail /> },
      { path: 'verify-email', element: <VerifyEmail /> },
      { path: 'forgot-password', element: <ForgotPassword /> },
      { path: 'reset-password', element: <ResetPassword /> },
      { path: 'oauth2/callback', element: <OAuthCallback /> },
      { path: 'complete-profile', element: <CompleteProfile /> },
      {
        element: <Protected adminOnly />,
        children: [
          {
            path: 'admin',
            element: <WorkspaceLayout workspace="admin" />,
            children: [
              { index: true, element: <AdminOverview /> },
              { path: 'users', element: <UserDirectory /> },
              { path: 'users/new', element: <CreateAdmin /> },
              { path: 'users/:id', element: <UserDetail /> },
              { path: 'users/:id/edit', element: <UserEdit /> },
              { path: 'audit-logs', element: <AuditLogs /> },
            ],
          },
        ],
      },
      {
        element: <Protected />,
        children: [
          {
            path: 'account',
            element: <WorkspaceLayout workspace="account" />,
            children: [
              { index: true, element: <AccountHome /> },
              { path: 'profile', element: <AccountProfile /> },
              { path: 'email', element: <AccountEmail /> },
              { path: 'security', element: <AccountSecurity /> },
              { path: 'sessions', element: <AccountSessions /> },
            ],
          },
        ],
      },
      { path: 'forbidden', element: <Missing forbidden /> },
      { path: '*', element: <Missing /> },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
