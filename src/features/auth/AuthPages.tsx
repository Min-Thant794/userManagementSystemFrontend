import { useEffect, useRef, useState } from 'react';
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router';
import { z } from 'zod';
import { api, API_BASE_URL, ApiError } from '../../shared/api/client';
import {
  email,
  password,
  phoneNumber,
  username,
} from '../../shared/api/validation';
import { useAuth } from '../../shared/auth/useAuth';
import { AuthShell, Button, LoadingState, Notice } from '../../shared/ui';
import { Form } from '../../shared/ui/Form';
import { safeReturnPath } from '../../shared/auth/routing';
const emailSchema = z.object({ email });
const passwordFields = [
  {
    name: 'newPassword',
    label: 'New password',
    type: 'password',
    autoComplete: 'new-password',
    hint: 'At least 8 characters, including a letter and a number.',
  },
  {
    name: 'confirmPassword',
    label: 'Confirm new password',
    type: 'password',
    autoComplete: 'new-password',
  },
];
const newPasswordSchema = z
  .object({ newPassword: password, confirmPassword: z.string() })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });
function useLinkToken() {
  const [token] = useState(
    () => new URLSearchParams(window.location.search).get('token') ?? '',
  );
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    if (new URLSearchParams(location.search).has('token'))
      navigate(location.pathname, { replace: true });
  }, [location.pathname, location.search, navigate]);
  return token;
}
export function Login() {
  const auth = useAuth();
  const [params] = useSearchParams();
  const [verification, setVerification] = useState(false);
  if (auth.status === 'authenticated' && auth.user)
    return (
      <Navigate
        to={safeReturnPath(params.get('returnTo'), auth.user.role)}
        replace
      />
    );
  if (auth.status === 'incomplete')
    return <Navigate to="/complete-profile" replace />;
  return (
    <AuthShell
      title="Welcome back"
      description="Sign in to your workspace to continue."
      footer={
        <>
          New here? <Link to="/signup">Create an account</Link>
        </>
      }
    >
      <div className="stack">
        {auth.error && (
          <Notice tone="warning">
            {auth.error}
            {auth.error.includes('server sign-out') && (
              <Button variant="secondary" onClick={() => void auth.logout()}>
                Retry sign-out
              </Button>
            )}
          </Notice>
        )}
        <Form
          guard={false}
          schema={z.object({
            identifier: z
              .string()
              .trim()
              .min(1, 'Enter your username or email.'),
            password: z.string().min(1, 'Enter your password.'),
          })}
          fields={[
            {
              name: 'identifier',
              label: 'Email or username',
              autoComplete: 'username',
            },
            {
              name: 'password',
              label: 'Password',
              type: 'password',
              autoComplete: 'current-password',
            },
          ]}
          submitLabel="Sign in"
          onSubmit={async (data) => {
            try {
              await auth.login(data.identifier, data.password);
            } catch (error) {
              setVerification(
                error instanceof ApiError &&
                  error.action === 'resend_verification',
              );
              throw error;
            }
          }}
        />
        {verification && (
          <Notice tone="info">
            Verify your email before signing in.{' '}
            <Link to="/check-email">Request a verification email</Link>.
          </Notice>
        )}
        <Link className="text-link" to="/forgot-password">
          Forgot password?
        </Link>
        <hr className="divider" />
        <a
          className="button-link secondary"
          href={`${API_BASE_URL}/oauth2/authorization/google`}
        >
          Continue with Google
        </a>
      </div>
    </AuthShell>
  );
}
export function Signup() {
  const navigate = useNavigate();
  const schema = z
    .object({
      username,
      email,
      phoneNumber,
      password,
      confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: 'Passwords do not match.',
      path: ['confirmPassword'],
    });
  return (
    <AuthShell
      title="Create your account"
      description="A single account for your profile, security and devices."
      footer={
        <>
          Already a member? <Link to="/login">Sign in</Link>
        </>
      }
    >
      <Form
        schema={schema}
        submitLabel="Create account"
        fields={[
          {
            name: 'username',
            label: 'Username',
            autoComplete: 'username',
            hint: '3–50 letters, numbers or underscores.',
          },
          {
            name: 'email',
            label: 'Email address',
            type: 'email',
            autoComplete: 'email',
          },
          {
            name: 'phoneNumber',
            label: 'Phone number',
            type: 'tel',
            autoComplete: 'tel',
            hint: '7–15 digits, optionally starting with +.',
          },
          {
            name: 'password',
            label: 'Password',
            type: 'password',
            autoComplete: 'new-password',
            hint: 'At least 8 characters, including a letter and a number.',
          },
          {
            name: 'confirmPassword',
            label: 'Confirm password',
            type: 'password',
            autoComplete: 'new-password',
          },
        ]}
        onSubmit={async ({ username, email, phoneNumber, password }) => {
          await api('/api/auth/signup', {
            method: 'POST',
            auth: false,
            body: { username, email, phoneNumber, password },
          });
          navigate('/check-email', { replace: true });
        }}
      />
    </AuthShell>
  );
}
export function CheckEmail() {
  const [sent, setSent] = useState(false);
  return (
    <AuthShell
      title="Check your inbox"
      description="Open the verification link sent to your email. It expires after 24 hours; a newer link replaces the previous one."
      footer={<Link to="/login">Back to sign in</Link>}
    >
      <div className="stack">
        {sent && (
          <Notice tone="success">
            If this address is eligible, a verification email has been sent.
          </Notice>
        )}
        <Form
          guard={false}
          schema={emailSchema}
          fields={[
            {
              name: 'email',
              label: 'Email address',
              type: 'email',
              autoComplete: 'email',
            },
          ]}
          submitLabel="Resend verification email"
          onSubmit={async (body) => {
            await api('/api/auth/resend-verification', {
              method: 'POST',
              auth: false,
              body,
            });
            setSent(true);
          }}
        />
        <p className="muted">
          Check your spam folder too. This form is for registration
          verification. Pending changes to an already verified email currently
          cannot be resent.
        </p>
      </div>
    </AuthShell>
  );
}
export function VerifyEmail() {
  const token = useLinkToken();
  const [done, setDone] = useState(false);
  const { clearSession } = useAuth();
  return (
    <AuthShell
      title={done ? 'Email verified' : 'Verify your email'}
      description="Confirm this action to use your verification link."
      footer={<Link to="/login">Continue to sign in</Link>}
    >
      {done ? (
        <Notice tone="success">
          Your email is verified. Sign in to continue.
        </Notice>
      ) : !token ? (
        <Notice tone="warning">
          This link has no token. Open the original email link, or{' '}
          <Link to="/check-email">request a new verification email</Link>.
        </Notice>
      ) : (
        <Form
          guard={false}
          schema={z.object({})}
          fields={[]}
          submitLabel="Verify email"
          onSubmit={async () => {
            await api('/api/auth/verify-email', {
              method: 'POST',
              auth: false,
              body: { token },
            });
            clearSession('Your email was verified. Please sign in again.');
            setDone(true);
          }}
        />
      )}
    </AuthShell>
  );
}
export function ForgotPassword() {
  const [sent, setSent] = useState(false);
  return (
    <AuthShell
      title="Reset your password"
      description="We’ll send instructions if your email matches an eligible account."
      footer={<Link to="/login">Back to sign in</Link>}
    >
      <div className="stack">
        {sent && (
          <Notice tone="success">
            If the account is eligible, a reset link has been sent. Use it
            within 30 minutes.
          </Notice>
        )}
        <Form
          guard={false}
          schema={emailSchema}
          fields={[
            {
              name: 'email',
              label: 'Email address',
              type: 'email',
              autoComplete: 'email',
            },
          ]}
          submitLabel="Send reset link"
          onSubmit={async (body) => {
            await api('/api/auth/forgot-password', {
              method: 'POST',
              auth: false,
              body,
            });
            setSent(true);
          }}
        />
      </div>
    </AuthShell>
  );
}
export function ResetPassword() {
  const token = useLinkToken();
  const [done, setDone] = useState(false);
  const { clearSession } = useAuth();
  return (
    <AuthShell
      title={done ? 'Password updated' : 'Choose a new password'}
      description="Use a password you haven’t used for another account."
      footer={<Link to="/login">Back to sign in</Link>}
    >
      {done ? (
        <Notice tone="success">
          Your password has changed. Please sign in again.
        </Notice>
      ) : !token ? (
        <Notice tone="warning">
          Open your original reset link, or{' '}
          <Link to="/forgot-password">request a new one</Link>.
        </Notice>
      ) : (
        <Form
          schema={newPasswordSchema}
          fields={passwordFields}
          submitLabel="Reset password"
          onSubmit={async ({ newPassword }) => {
            await api('/api/auth/reset-password', {
              method: 'POST',
              auth: false,
              body: { token, newPassword },
            });
            clearSession('Password changed. Please sign in again.');
            setDone(true);
          }}
        />
      )}
    </AuthShell>
  );
}
export function OAuthCallback() {
  const auth = useAuth();
  const started = useRef(false);
  useEffect(() => {
    if (!started.current) {
      started.current = true;
      void auth.retrySession();
    }
  }, [auth]);
  if (auth.status === 'authenticated' && auth.user)
    return (
      <Navigate
        to={auth.user.role === 'ADMIN' ? '/admin' : '/account'}
        replace
      />
    );
  if (auth.status === 'incomplete')
    return <Navigate to="/complete-profile" replace />;
  return (
    <AuthShell title="Completing sign in">
      {auth.status === 'loading' ? (
        <LoadingState label="Restoring your session…" />
      ) : (
        <div className="stack">
          <Notice tone="error">
            {auth.error ?? 'Sign in could not be completed. Please try again.'}
          </Notice>
          <Link to="/login">Back to sign in</Link>
        </div>
      )}
    </AuthShell>
  );
}
export function CompleteProfile() {
  const auth = useAuth();
  if (auth.status === 'loading') return <LoadingState />;
  if (auth.status === 'authenticated')
    return (
      <Navigate
        to={auth.user?.role === 'ADMIN' ? '/admin' : '/account'}
        replace
      />
    );
  if (auth.status !== 'incomplete') return <Navigate to="/login" replace />;
  return (
    <AuthShell
      title="Make this account yours"
      description="Add a username and phone number to finish setting up your profile."
      footer={
        <Button variant="ghost" onClick={() => void auth.logout()}>
          Sign out
        </Button>
      }
    >
      <Form
        schema={z.object({ username, phoneNumber })}
        fields={[
          {
            name: 'username',
            label: 'Username',
            autoComplete: 'username',
            hint: '3–50 letters, numbers or underscores.',
          },
          {
            name: 'phoneNumber',
            label: 'Phone number',
            type: 'tel',
            autoComplete: 'tel',
          },
        ]}
        submitLabel="Complete profile"
        onSubmit={async (body) => {
          try {
            await api('/api/users/me/complete-profile', {
              method: 'POST',
              body,
            });
          } catch (error) {
            if (error instanceof ApiError && error.status === 403) {
              const user = await auth.reloadUser();
              if (user) return;
            }
            throw error;
          }
          await auth.reloadUser();
        }}
      />
    </AuthShell>
  );
}
