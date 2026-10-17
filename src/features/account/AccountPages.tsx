import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Camera,
  CircleUserRound,
  Mail,
  MonitorSmartphone,
  ShieldCheck,
} from 'lucide-react';
import { z } from 'zod';
import { useAuth } from '../../shared/auth/useAuth';
import type { User } from '../../shared/api/types';
import {
  email,
  password,
  phoneNumber,
  username,
} from '../../shared/api/validation';
import {
  Avatar,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  Notice,
  PageHeader,
  formatDate,
} from '../../shared/ui';
import { Form } from '../../shared/ui/Form';
import {
  listSessions,
  removePhoto,
  revokeSession,
  updatePassword,
  updateProfile,
  uploadPhoto,
} from './api';
export function AccountHome() {
  const { user } = useAuth();
  return (
    <>
      <PageHeader
        eyebrow="MY ACCOUNT"
        title={`Welcome, ${user?.username ?? 'member'}.`}
        description="Your profile, security and devices, all in one place."
      />
      <div className="stack">
        <Card>
          <div className="inline">
            <Avatar
              name={user?.username}
              src={user?.profileImageUrl}
              size="lg"
            />
            <div>
              <h2>{user?.username}</h2>
              <p className="muted">{user?.email}</p>
              <Badge>
                {user?.role === 'ADMIN' ? 'Administrator' : 'Member'}
              </Badge>
            </div>
          </div>
        </Card>
        {user?.pendingEmail && (
          <Notice tone="warning">
            A change to {user.pendingEmail} is waiting for verification. Your
            current email is still {user.email}.{' '}
            <Link to="/account/email">View email details</Link>
          </Notice>
        )}
        <div className="two-column">
          {[
            {
              to: '/account/profile',
              title: 'Your profile',
              text: 'Update your name, phone number and profile photo.',
              icon: CircleUserRound,
            },
            {
              to: '/account/security',
              title: 'Account security',
              text: 'Create or change your account password.',
              icon: ShieldCheck,
            },
            {
              to: '/account/email',
              title: 'Email address',
              text: 'Manage your current and pending email addresses.',
              icon: Mail,
            },
            {
              to: '/account/sessions',
              title: 'Devices & sessions',
              text: 'Review where you are signed in and manage sessions.',
              icon: MonitorSmartphone,
            },
          ].map(({ to, title, text, icon: Icon }) => (
            <Card key={to}>
              <Icon color="var(--accent)" size={24} />
              <h2 style={{ fontSize: '1.05rem' }}>{title}</h2>
              <p className="muted">{text}</p>
              <Link className="text-link inline" to={to}>
                Open {title.toLowerCase()} <ArrowRight size={15} />
              </Link>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
function useProfileRefresh() {
  const auth = useAuth();
  const client = useQueryClient();
  return async () => {
    await auth.reloadUser();
    await client.invalidateQueries({
      predicate: (query) =>
        query.queryKey[0] === auth.epoch && query.queryKey[1] === auth.user?.id,
    });
  };
}
export function AccountProfile() {
  const { user } = useAuth();
  const refresh = useProfileRefresh();
  const [saved, setSaved] = useState(false);
  if (!user) return null;
  return (
    <>
      <PageHeader
        eyebrow="PERSONAL DETAILS"
        title="My profile"
        description="Keep your account details up to date."
      />
      <div className="two-column">
        <Card title="Profile information">
          <div className="stack">
            {saved && (
              <Notice tone="success">
                Your changes were saved. Any new email address must be verified
                before it becomes current.
              </Notice>
            )}
            <Form
              schema={z.object({ username, email, phoneNumber })}
              initial={{
                username: user.username ?? '',
                email: user.email,
                phoneNumber: user.phoneNumber ?? '',
              }}
              fields={[
                {
                  name: 'username',
                  label: 'Username',
                  autoComplete: 'username',
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
                },
              ]}
              onSubmit={async (data) => {
                const body = Object.fromEntries(
                  Object.entries(data).filter(
                    ([key, value]) => value !== user[key as keyof User],
                  ),
                );
                if (body.email && body.email === user.pendingEmail)
                  throw new Error(
                    'This address is already waiting for verification. Open the email we sent to it.',
                  );
                if (Object.keys(body).length) await updateProfile(body);
                await refresh();
                setSaved(true);
              }}
            />
            {user.pendingEmail && (
              <Notice tone="warning">
                Waiting for verification: {user.pendingEmail}.{' '}
                <Link to="/account/email">View email details</Link>
              </Notice>
            )}
          </div>
        </Card>
        <PhotoCard />
      </div>
    </>
  );
}
async function validatePhoto(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new Error('Choose a JPEG, PNG or WebP image.');
  if (file.size > 5 * 1024 * 1024 - 65536)
    throw new Error(
      'Choose an image smaller than 4.9 MiB to allow space for the upload request.',
    );
  const url = URL.createObjectURL(file);
  try {
    await new Promise<void>((resolve, reject) => {
      const image = new Image();
      image.onload = () =>
        image.width >= 50 &&
        image.height >= 50 &&
        image.width <= 4000 &&
        image.height <= 4000
          ? resolve()
          : reject(
              new Error(
                'Image width and height must each be between 50 and 4000 pixels.',
              ),
            );
      image.onerror = () =>
        reject(
          new Error('This image could not be read. Choose a different file.'),
        );
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
function PhotoCard() {
  const { user } = useAuth();
  const refresh = useProfileRefresh();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState(false);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return (
    <Card
      title="Profile photo"
      description="A little more you. Your photo appears across both workspaces."
    >
      <div className="stack">
        <div className="inline">
          {preview ? (
            <img
              src={preview}
              alt="Selected photo preview"
              style={{
                width: 88,
                height: 88,
                borderRadius: '50%',
                objectFit: 'cover',
              }}
            />
          ) : (
            <Avatar
              name={user?.username}
              src={user?.profileImageUrl}
              size="lg"
            />
          )}
          <Camera size={20} color="var(--muted)" />
        </div>
        <Field
          label="Choose an image"
          hint="JPEG, PNG or WebP, up to 4.9 MiB. Dimensions: 50–4000 pixels per side. Your photo will be cropped to a 300 × 300 square."
        >
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
            onChange={(event) => {
              const selected = event.target.files?.[0];
              setDone(false);
              setError(null);
              setFile(null);
              if (selected)
                void validatePhoto(selected)
                  .then(() => setFile(selected))
                  .catch(setError);
            }}
          />
        </Field>
        {error ? <ErrorState error={error} /> : null}
        {done && (
          <Notice tone="success">Your profile photo has been updated.</Notice>
        )}
        <div className="form-actions">
          <Button
            disabled={!file}
            busy={busy}
            onClick={() => {
              void (async () => {
                if (!file) return;
                setBusy(true);
                setError(null);
                try {
                  await uploadPhoto(file);
                  await refresh();
                  setDone(true);
                  setFile(null);
                  if (input.current) input.current.value = '';
                } catch (error) {
                  setError(error);
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            Upload photo
          </Button>
          {user?.profileImageUrl && (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setConfirm(true)}
            >
              Remove photo
            </Button>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={confirm}
        title="Remove your photo?"
        description="Your initials will appear in its place."
        confirmLabel="Remove photo"
        busy={busy}
        onClose={() => setConfirm(false)}
        onConfirm={() => {
          void (async () => {
            setBusy(true);
            setError(null);
            try {
              await removePhoto();
              await refresh();
              setConfirm(false);
              setDone(true);
            } catch (error) {
              setError(error);
            } finally {
              setBusy(false);
            }
          })();
        }}
      >
        {error ? <ErrorState error={error} /> : null}
      </ConfirmDialog>
    </Card>
  );
}
export function AccountEmail() {
  const { user } = useAuth();
  const refresh = useProfileRefresh();
  const [sent, setSent] = useState(false);
  return (
    <>
      <PageHeader
        eyebrow="CONTACT & VERIFICATION"
        title="Email address"
        description="Your current email stays active until the new address is verified."
      />
      <div className="two-column">
        <Card title="Email details">
          <dl>
            <dt>Current email</dt>
            <dd>{user?.email}</dd>
            <dt>Pending email</dt>
            <dd>{user?.pendingEmail ?? 'No pending change'}</dd>
          </dl>
          {user?.pendingEmail && (
            <Notice tone="warning">
              Check the inbox for {user.pendingEmail}. Pending-email resend and
              cancellation are not available yet. If the link expires, contact
              an administrator for help.
            </Notice>
          )}
        </Card>
        <Card title="Change email">
          <div className="stack">
            {sent && (
              <Notice tone="success">
                A verification link was requested for your new email.
                Verification will require you to sign in again.
              </Notice>
            )}
            <Form
              schema={z.object({ email })}
              fields={[
                {
                  name: 'email',
                  label: 'New email address',
                  type: 'email',
                  autoComplete: 'email',
                },
              ]}
              submitLabel="Send verification link"
              onSubmit={async (body) => {
                if (body.email === user?.email)
                  throw new Error('This is already your current email.');
                if (body.email === user?.pendingEmail)
                  throw new Error(
                    'This email is already waiting for verification.',
                  );
                await updateProfile(body);
                await refresh();
                setSent(true);
              }}
            />
          </div>
        </Card>
      </div>
    </>
  );
}
export function AccountSecurity() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('change');
  const [done, setDone] = useState(false);
  const initial = mode === 'initial';
  const schema = z
    .object({
      ...(!initial
        ? { currentPassword: z.string().min(1, 'Enter your current password.') }
        : {}),
      newPassword: password,
      confirmPassword: z.string(),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: 'Passwords do not match.',
      path: ['confirmPassword'],
    });
  return (
    <>
      <PageHeader
        eyebrow="ACCOUNT PROTECTION"
        title="Security"
        description="Manage the password you use to sign in."
      />
      <div className="two-column">
        <Card
          title={initial ? 'Create your first password' : 'Change password'}
        >
          <div className="stack">
            <Field
              label="Password action"
              hint="Choose whether you already use a password or have only signed in with Google."
            >
              <select
                value={mode}
                onChange={(event) => {
                  setMode(event.target.value);
                  setDone(false);
                }}
              >
                <option value="change">I already have a password</option>
                <option value="initial">
                  I signed up with Google and have no password
                </option>
              </select>
            </Field>
            {done && (
              <Notice tone="success">
                Your first password is ready. You can now sign in with your
                email or username.
              </Notice>
            )}
            <Form
              key={mode}
              schema={schema as z.ZodType<Record<string, string>>}
              fields={[
                ...(!initial
                  ? [
                      {
                        name: 'currentPassword',
                        label: 'Current password',
                        type: 'password',
                        autoComplete: 'current-password',
                      },
                    ]
                  : []),
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
              ]}
              submitLabel={initial ? 'Create password' : 'Change password'}
              onSubmit={async (data) => {
                const body: Record<string, string> = initial
                  ? { newPassword: data.newPassword }
                  : {
                      currentPassword: data.currentPassword,
                      newPassword: data.newPassword,
                    };
                await updatePassword(body, initial);
                if (initial) setDone(true);
                else {
                  auth.clearSession('Password changed. Please sign in again.');
                  navigate('/login', { replace: true });
                }
              }}
            />
            <Link to="/forgot-password">Forgot your current password?</Link>
          </div>
        </Card>
        <Card title="What happens next">
          <p className="muted">
            Changing your existing password ends refresh sessions on all devices
            and asks you to sign in again here. Existing access tokens may
            remain usable for up to 15 minutes.
          </p>
          <p className="muted">
            Creating your first password keeps current sessions. If the selected
            action is incorrect, the server will reject it; switch to the other
            action.
          </p>
          <Link className="text-link" to="/account/sessions">
            Review your devices →
          </Link>
        </Card>
      </div>
    </>
  );
}
export function AccountSessions() {
  const auth = useAuth();
  const scope = [auth.epoch, auth.user?.id, 'account', 'sessions'];
  const query = useQuery({
    queryKey: scope,
    queryFn: ({ signal }) => listSessions(signal),
    staleTime: 0,
  });
  const navigate = useNavigate();
  const [selected, setSelected] = useState<number | 'others' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState(false);
  const hasCurrent = query.data?.some((session) => session.current) ?? false;
  return (
    <>
      <PageHeader
        eyebrow="SIGNED-IN DEVICES"
        title="Devices & sessions"
        description="Review recent sign-ins and request session revocation."
        actions={
          <Button variant="secondary" onClick={() => void query.refetch()}>
            Refresh list
          </Button>
        }
      />
      <div className="stack">
        <Notice tone="info">
          This list can change as devices renew their sessions. Revoking a
          listed session may miss one that has already changed. Existing access
          may continue for up to 15 minutes. For help ending access on another
          device, contact support.
        </Notice>
        {notice && (
          <Notice tone="success">
            The revocation request completed and the list was refreshed. The
            limitations above still apply.
          </Notice>
        )}
        {!hasCurrent && !query.isPending && (
          <Notice tone="warning">
            This browser’s current refresh session could not be identified.
            “Sign out other devices” is disabled to avoid revoking every
            session.
          </Notice>
        )}
        <Card
          title="Your sessions"
          description="Device names and locations are approximate and may show an IP address."
        >
          {query.isPending ? (
            <LoadingState />
          ) : query.error ? (
            <ErrorState
              error={query.error}
              onRetry={() => void query.refetch()}
            />
          ) : query.data.length ? (
            <div className="stack">
              {query.data.map((session) => (
                <div
                  key={session.id}
                  style={{
                    borderBottom: '1px solid var(--line)',
                    paddingBottom: 20,
                  }}
                >
                  <div className="inline">
                    <MonitorSmartphone size={23} />
                    <h3 style={{ fontSize: '.95rem' }}>{session.device}</h3>
                    {session.current && (
                      <Badge tone="success">This device</Badge>
                    )}
                  </div>
                  <dl>
                    <dt>Location</dt>
                    <dd>{session.location}</dd>
                    <dt>Created</dt>
                    <dd>{formatDate(session.createdAt)}</dd>
                    <dt>Last used</dt>
                    <dd>{formatDate(session.lastUsedAt)}</dd>
                  </dl>
                  {session.current ? (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        void auth.logout();
                        navigate('/login', { replace: true });
                      }}
                    >
                      Sign out this device
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setError(null);
                        setSelected(session.id);
                      }}
                    >
                      Revoke session
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No refresh sessions found"
              description="You may still have a valid access token. Sign in again to establish a new session."
            />
          )}
          <div className="form-actions" style={{ marginTop: 24 }}>
            <Button
              variant="danger"
              disabled={!hasCurrent || query.isFetching}
              onClick={() => {
                setError(null);
                setSelected('others');
              }}
            >
              Sign out other devices
            </Button>
          </div>
        </Card>
      </div>
      <ConfirmDialog
        open={selected !== null}
        title={
          selected === 'others'
            ? 'Revoke other refresh sessions?'
            : 'Revoke this refresh session?'
        }
        description="Existing access may continue briefly. The latest session list will be checked before sending this request."
        confirmLabel="Revoke session"
        danger
        busy={busy}
        onClose={() => setSelected(null)}
        onConfirm={() => {
          void (async () => {
            if (selected === null) return;
            setBusy(true);
            setError(null);
            try {
              const fresh = await listSessions();
              if (
                selected === 'others' &&
                !fresh.some((session) => session.current)
              )
                throw new Error(
                  'The current session is no longer identifiable. Refresh this page and sign in again.',
                );
              if (
                typeof selected === 'number' &&
                !fresh.some(
                  (session) => session.id === selected && !session.current,
                )
              )
                throw new Error(
                  'This session changed since it was displayed. Close this dialog and refresh the list.',
                );
              await revokeSession(selected);
              await query.refetch();
              setNotice(true);
              setSelected(null);
            } catch (error) {
              setError(error);
              void query.refetch();
            } finally {
              setBusy(false);
            }
          })();
        }}
      >
        {error ? <ErrorState error={error} /> : null}
      </ConfirmDialog>
    </>
  );
}
