import { useEffect, useState } from 'react';
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, UserPlus, Users } from 'lucide-react';
import { z } from 'zod';
import { useAuth } from '../../shared/auth/useAuth';
import type { AdminUser, AuditLog } from '../../shared/api/types';
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
  Pagination,
  formatDate,
} from '../../shared/ui';
import { Form } from '../../shared/ui/Form';
import {
  changeAccess,
  createAdmin,
  getUser,
  listAudit,
  listUsers,
  updateUser,
} from './api';
function useScope() {
  const { epoch, user } = useAuth();
  return [epoch, user?.id, 'admin'] as const;
}
function UserTable({ users }: { users: AdminUser[] }) {
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Person</th>
            <th scope="col">Role</th>
            <th scope="col">Status</th>
            <th scope="col">Verification</th>
            <th scope="col">Joined</th>
            <th scope="col">
              <span className="sr-only">Details</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>
                <div className="inline">
                  <Avatar
                    name={user.username}
                    src={user.profileImageUrl}
                    size="sm"
                  />
                  <div>
                    <Link className="text-link" to={`/admin/users/${user.id}`}>
                      {user.username ?? 'Profile incomplete'}
                    </Link>
                    <div className="muted">{user.email}</div>
                  </div>
                </div>
              </td>
              <td>
                <Badge>
                  {user.role === 'ADMIN' ? 'Administrator' : 'Member'}
                </Badge>
              </td>
              <td>
                <Badge tone={user.status === 'ACTIVE' ? 'success' : 'danger'}>
                  {user.status === 'ACTIVE' ? 'Active' : 'Suspended'}
                </Badge>
              </td>
              <td>
                <Badge tone={user.emailVerified ? 'success' : 'warning'}>
                  {user.emailVerified ? 'Verified' : 'Unverified'}
                </Badge>
              </td>
              <td className="muted">{formatDate(user.createdAt)}</td>
              <td>
                <Link
                  to={`/admin/users/${user.id}`}
                  aria-label={`View ${user.username ?? user.email}`}
                >
                  <ArrowRight size={17} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function AdminOverview() {
  const scope = useScope();
  const { user } = useAuth();
  const total = useQuery({
    queryKey: [...scope, 'count', 'all'],
    queryFn: ({ signal }) => listUsers({ size: 1 }, signal),
  });
  const active = useQuery({
    queryKey: [...scope, 'count', 'ACTIVE'],
    queryFn: ({ signal }) => listUsers({ size: 1, status: 'ACTIVE' }, signal),
  });
  const suspended = useQuery({
    queryKey: [...scope, 'count', 'SUSPENDED'],
    queryFn: ({ signal }) =>
      listUsers({ size: 1, status: 'SUSPENDED' }, signal),
  });
  const recent = useQuery({
    queryKey: [...scope, 'users', 'recent'],
    queryFn: ({ signal }) =>
      listUsers({ size: 5, sort: 'createdAt,desc' }, signal),
  });
  const audit = useQuery({
    queryKey: [...scope, 'audit', 'recent'],
    queryFn: ({ signal }) =>
      listAudit({ size: 4, sort: 'createdAt,desc' }, signal),
  });
  return (
    <>
      <PageHeader
        eyebrow="ADMINISTRATION"
        title={`Good to see you, ${user?.username ?? 'administrator'}.`}
        description="A clear view of your people, their access and recent changes."
        actions={
          <Link to="/admin/users/new" className="button-link">
            <UserPlus size={16} />
            Create administrator
          </Link>
        }
      />
      <div className="stack">
        <div className="metric-grid">
          {[
            {
              label: 'Total users',
              query: total,
              note: 'All registered accounts',
            },
            {
              label: 'Active accounts',
              query: active,
              note: 'Accounts with active status',
            },
            {
              label: 'Suspended accounts',
              query: suspended,
              note: 'Access currently suspended',
            },
          ].map(({ label, query, note }) => (
            <div className="metric" key={label}>
              <p>{label}</p>
              {query.isPending ? (
                <span role="status">Loading…</span>
              ) : query.error ? (
                <ErrorState
                  error={query.error}
                  onRetry={() => void query.refetch()}
                />
              ) : (
                <strong>
                  {query.data.page.totalElements.toLocaleString()}
                </strong>
              )}
              <small>{note}</small>
            </div>
          ))}
        </div>
        <p className="muted" style={{ fontSize: '.72rem', margin: 0 }}>
          Counts are separate current snapshots. An active status does not
          guarantee a verified or unlocked account.
        </p>
        <Card
          title="Recently joined"
          description="The newest accounts in your workspace."
        >
          {recent.isPending ? (
            <LoadingState />
          ) : recent.error ? (
            <ErrorState
              error={recent.error}
              onRetry={() => void recent.refetch()}
            />
          ) : recent.data.content.length ? (
            <UserTable users={recent.data.content} />
          ) : (
            <EmptyState title="No accounts yet" />
          )}
          <div className="form-actions" style={{ paddingTop: 16 }}>
            <Link to="/admin/users" className="text-link">
              View all users →
            </Link>
          </div>
        </Card>
        <Card
          title="Recent administrator activity"
          description="Recorded changes to accounts and permissions."
        >
          {audit.isPending ? (
            <LoadingState />
          ) : audit.error ? (
            <ErrorState
              error={audit.error}
              onRetry={() => void audit.refetch()}
            />
          ) : (
            <AuditTable records={audit.data.content} />
          )}
          <Link to="/admin/audit-logs" className="text-link">
            Open audit log →
          </Link>
        </Card>
      </div>
    </>
  );
}
const userSorts = [
  'createdAt,desc',
  'createdAt,asc',
  'username,asc',
  'username,desc',
  'email,asc',
];
function safePage(value: string | null) {
  const parsed = Number(value ?? 0);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}
export function UserDirectory() {
  const scope = useScope();
  const [params, setParams] = useSearchParams();
  const page = safePage(params.get('page'));
  const size = [10, 20, 50].includes(Number(params.get('size')))
    ? Number(params.get('size'))
    : 10;
  const search = params.get('search') ?? '';
  const role = ['USER', 'ADMIN'].includes(params.get('role') ?? '')
    ? params.get('role')!
    : '';
  const status = ['ACTIVE', 'SUSPENDED'].includes(params.get('status') ?? '')
    ? params.get('status')!
    : '';
  const sort = userSorts.includes(params.get('sort') ?? '')
    ? params.get('sort')!
    : 'createdAt,desc';
  const [debounced, setDebounced] = useState(search);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const filters = { search: debounced, role, status, sort, page, size };
  const users = useQuery({
    queryKey: [...scope, 'users', filters],
    queryFn: ({ signal }) => listUsers(filters, signal),
  });
  const update = (key: string, value: string) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value) next.set(key, value);
        else next.delete(key);
        if (key !== 'page') next.delete('page');
        return next;
      },
      { replace: key === 'search' },
    );
  useEffect(() => {
    if (users.data && page > 0 && page >= users.data.page.totalPages)
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          next.set('page', String(Math.max(0, users.data.page.totalPages - 1)));
          return next;
        },
        { replace: true },
      );
  }, [users.data, page, setParams]);
  return (
    <>
      <PageHeader
        eyebrow="PEOPLE"
        title="User directory"
        description="Find accounts and manage each person’s profile and access."
        actions={
          <Link className="button-link" to="/admin/users/new">
            <UserPlus size={16} />
            Create administrator
          </Link>
        }
      />
      <Card>
        <div className="toolbar">
          <Field label="Search users">
            <input
              placeholder="Name, email or phone…"
              value={search}
              onChange={(event) => update('search', event.target.value)}
            />
          </Field>
          <Field label="Role">
            <select
              value={role}
              onChange={(event) => update('role', event.target.value)}
            >
              <option value="">All roles</option>
              <option value="USER">Members</option>
              <option value="ADMIN">Administrators</option>
            </select>
          </Field>
          <Field label="Status">
            <select
              value={status}
              onChange={(event) => update('status', event.target.value)}
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </Field>
          <Field label="Sort by">
            <select
              value={sort}
              onChange={(event) => update('sort', event.target.value)}
            >
              <option value="createdAt,desc">Newest first</option>
              <option value="createdAt,asc">Oldest first</option>
              <option value="username,asc">Username A–Z</option>
              <option value="username,desc">Username Z–A</option>
              <option value="email,asc">Email A–Z</option>
            </select>
          </Field>
        </div>
        {search !== debounced && (
          <p role="status" className="muted">
            Updating search…
          </p>
        )}
        {users.isPending ? (
          <LoadingState label="Loading your directory…" />
        ) : users.error ? (
          <ErrorState
            error={users.error}
            onRetry={() => void users.refetch()}
          />
        ) : (
          <>
            {users.data.content.length ? (
              <UserTable users={users.data.content} />
            ) : (
              <EmptyState
                title="No matching accounts"
                description="Try a different search or clear your filters."
                action={
                  <Button variant="secondary" onClick={() => setParams({})}>
                    Clear filters
                  </Button>
                }
              />
            )}
            <Pagination
              {...users.data.page}
              page={users.data.page.number}
              onPageChange={(value) => update('page', String(value))}
            />
          </>
        )}
        <div style={{ maxWidth: 140, marginTop: 18 }}>
          <Field label="Rows per page">
            <select
              value={size}
              onChange={(event) => update('size', event.target.value)}
            >
              {[10, 20, 50].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </Field>
        </div>
      </Card>
    </>
  );
}
function AuditTable({ records }: { records: AuditLog[] }) {
  return records.length ? (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Action</th>
            <th scope="col">People</th>
            <th scope="col">Date</th>
            <th scope="col">Details</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id}>
              <td>
                <Badge>{record.action.replaceAll('_', ' ')}</Badge>
              </td>
              <td>
                <div className="stack tight">
                  {record.actorUserId && (
                    <Link to={`/admin/users/${record.actorUserId}`}>
                      Actor: {record.actorUserId.slice(0, 8)}…
                    </Link>
                  )}
                  {record.targetUserId && (
                    <Link to={`/admin/users/${record.targetUserId}`}>
                      Target: {record.targetUserId.slice(0, 8)}…
                    </Link>
                  )}
                  {!record.actorUserId &&
                    !record.targetUserId &&
                    'Not recorded'}
                </div>
              </td>
              <td>{formatDate(record.createdAt)}</td>
              <td>
                <details>
                  <summary>View change #{record.id}</summary>
                  <pre>{JSON.stringify(record.details, null, 2)}</pre>
                </details>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <EmptyState
      title="No recorded actions"
      description="Actions matching these filters will appear here."
    />
  );
}
export function AuditLogs() {
  const scope = useScope();
  const [params, setParams] = useSearchParams();
  const page = safePage(params.get('page'));
  const action = params.get('action') ?? '';
  const actorUserId = params.get('actorUserId') ?? '';
  const targetUserId = params.get('targetUserId') ?? '';
  const validIds =
    (!actorUserId || z.string().uuid().safeParse(actorUserId).success) &&
    (!targetUserId || z.string().uuid().safeParse(targetUserId).success);
  const filters = {
    page,
    size: 10,
    sort: 'createdAt,desc',
    action,
    actorUserId,
    targetUserId,
  };
  const records = useQuery({
    queryKey: [...scope, 'audit', filters],
    queryFn: ({ signal }) => listAudit(filters, signal),
    enabled: validIds,
  });
  const update = (key: string, value: string) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value) next.set(key, value);
        else next.delete(key);
        if (key !== 'page') next.delete('page');
        return next;
      },
      { replace: key !== 'page' },
    );
  return (
    <>
      <PageHeader
        eyebrow="ACCOUNTABILITY"
        title="Audit log"
        description="Review administrator actions and inspect the changes recorded by the server."
      />
      <div className="stack">
        <Notice tone="info">
          Email-change requests are not fully recorded yet. This log is not a
          complete history of all account activity.
        </Notice>
        <Card>
          <div className="toolbar">
            <Field label="Action">
              <select
                value={action}
                onChange={(event) => update('action', event.target.value)}
              >
                <option value="">All actions</option>
                {[
                  'ROLE_CHANGE',
                  'SUSPEND',
                  'REACTIVATE',
                  'UPDATE',
                  'ADMIN_CREATED',
                ].map((value) => (
                  <option value={value} key={value}>
                    {value.replaceAll('_', ' ')}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Actor user ID">
              <input
                value={actorUserId}
                placeholder="Full UUID"
                onChange={(event) => update('actorUserId', event.target.value)}
              />
            </Field>
            <Field label="Target user ID">
              <input
                value={targetUserId}
                placeholder="Full UUID"
                onChange={(event) => update('targetUserId', event.target.value)}
              />
            </Field>
            <Button variant="secondary" onClick={() => setParams({})}>
              Clear
            </Button>
          </div>
          {!validIds ? (
            <Notice tone="warning">
              Enter a complete UUID to filter by a person.
            </Notice>
          ) : records.isPending ? (
            <LoadingState />
          ) : records.error ? (
            <ErrorState
              error={records.error}
              onRetry={() => void records.refetch()}
            />
          ) : (
            <>
              <AuditTable records={records.data.content} />
              <Pagination
                {...records.data.page}
                page={records.data.page.number}
                onPageChange={(value) => update('page', String(value))}
              />
            </>
          )}
        </Card>
      </div>
    </>
  );
}
function useUserDetail() {
  const { id = '' } = useParams();
  const scope = useScope();
  return {
    id,
    query: useQuery({
      queryKey: [...scope, 'user', id],
      queryFn: ({ signal }) => getUser(id, signal),
      enabled: z.string().uuid().safeParse(id).success,
    }),
  };
}
export function UserDetail() {
  const { id, query } = useUserDetail();
  const auth = useAuth();
  const scope = useScope();
  const client = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [change, setChange] = useState<{
    kind: 'role' | 'status';
    value: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  if (!z.string().uuid().safeParse(id).success)
    return (
      <EmptyState
        title="Invalid user ID"
        action={<Link to="/admin/users">Back to directory</Link>}
      />
    );
  if (query.isPending) return <LoadingState />;
  if (query.error)
    return (
      <ErrorState error={query.error} onRetry={() => void query.refetch()} />
    );
  const user = query.data;
  const self = user.id === auth.user?.id;
  return (
    <>
      <PageHeader
        eyebrow="USER DETAILS"
        title={user.username ?? 'Incomplete profile'}
        description={user.email}
        actions={
          <>
            <Link to="/admin/users" className="text-link">
              Back to directory
            </Link>
            <Link className="button-link" to={`/admin/users/${id}/edit`}>
              Edit profile
            </Link>
          </>
        }
      />
      <div className="stack">
        {location.state?.emailRequested && (
          <Notice tone="success">
            A verification link was requested for{' '}
            {String(location.state.emailRequested)}. The current email remains
            unchanged until verified. The new address will appear here after
            verification.
          </Notice>
        )}
        <div className="two-column">
          <Card title="Profile">
            <div className="inline" style={{ marginBottom: 22 }}>
              <Avatar
                name={user.username}
                src={user.profileImageUrl}
                size="lg"
              />
              <div>
                <h2>{user.username ?? 'Not set'}</h2>
                <Badge tone={user.status === 'ACTIVE' ? 'success' : 'danger'}>
                  {user.status}
                </Badge>{' '}
                {self && <Badge>Your account</Badge>}
              </div>
            </div>
            <dl>
              <dt>User ID</dt>
              <dd>{user.id}</dd>
              <dt>Email</dt>
              <dd>{user.email}</dd>
              <dt>Phone</dt>
              <dd>{user.phoneNumber ?? 'Not set'}</dd>
              <dt>Email verified</dt>
              <dd>{user.emailVerified ? 'Yes' : 'No'}</dd>
              <dt>Profile complete</dt>
              <dd>{user.profileComplete ? 'Yes' : 'No'}</dd>
              <dt>Created</dt>
              <dd>{formatDate(user.createdAt)}</dd>
              <dt>Last updated</dt>
              <dd>{formatDate(user.updatedAt)}</dd>
            </dl>
          </Card>
          <div className="stack">
            <Card
              title="Access & permissions"
              description="Changes affect this person’s access to the workspace."
            >
              <dl>
                <dt>Role</dt>
                <dd>
                  <Badge>{user.role}</Badge>
                </dd>
                <dt>Failed sign-ins</dt>
                <dd>{user.failedLoginAttempts}</dd>
                <dt>Locked until</dt>
                <dd>{formatDate(user.lockedUntil)}</dd>
              </dl>
              <div className="form-actions">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setFailure(null);
                    setChange({
                      kind: 'role',
                      value: user.role === 'ADMIN' ? 'USER' : 'ADMIN',
                    });
                  }}
                >
                  {user.role === 'ADMIN'
                    ? 'Change to member'
                    : 'Make administrator'}
                </Button>
                <Button
                  variant={user.status === 'ACTIVE' ? 'danger' : 'secondary'}
                  onClick={() => {
                    setFailure(null);
                    setChange({
                      kind: 'status',
                      value: user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE',
                    });
                  }}
                >
                  {user.status === 'ACTIVE'
                    ? 'Suspend account'
                    : 'Reactivate account'}
                </Button>
              </div>
              {self && (
                <p className="muted">
                  Changing your own access may end this administrator session.
                  The server protects the last active administrator.
                </p>
              )}
            </Card>
            <Card title="Recorded activity">
              <p className="muted">
                Review administrator actions concerning this account.
              </p>
              <Link
                to={`/admin/audit-logs?targetUserId=${id}`}
                className="text-link"
              >
                View this user’s audit log →
              </Link>
            </Card>
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={Boolean(change)}
        title={
          change?.kind === 'role'
            ? 'Change account role?'
            : 'Change account status?'
        }
        description={`Set ${user.username ?? user.email} ${change?.kind ?? 'access'} to ${change?.value ?? ''}.${self ? ' This is your own account.' : ''}`}
        confirmLabel="Confirm change"
        danger={change?.value === 'SUSPENDED' || change?.value === 'USER'}
        busy={busy}
        onClose={() => setChange(null)}
        onConfirm={() => {
          void (async () => {
            if (!change) return;
            setBusy(true);
            setFailure(null);
            try {
              const result = await changeAccess(id, change.kind, change.value);
              if (self) {
                await client.cancelQueries({ queryKey: scope });
                // Leave the admin route before reloading permissions changes its guard.
                await navigate('/account', { replace: true, flushSync: true });
                client.removeQueries({ queryKey: scope });
                await auth.reloadUser();
              } else {
                client.setQueryData([...scope, 'user', id], result);
                await client.invalidateQueries({ queryKey: scope });
              }
              setChange(null);
            } catch (error) {
              setFailure(error);
            } finally {
              setBusy(false);
            }
          })();
        }}
      >
        {failure ? <ErrorState error={failure} /> : null}
      </ConfirmDialog>
    </>
  );
}
export function UserEdit() {
  const { id, query } = useUserDetail();
  const scope = useScope();
  const client = useQueryClient();
  const auth = useAuth();
  const navigate = useNavigate();
  if (!z.string().uuid().safeParse(id).success)
    return <EmptyState title="Invalid user ID" />;
  if (query.isPending) return <LoadingState />;
  if (query.error)
    return (
      <ErrorState error={query.error} onRetry={() => void query.refetch()} />
    );
  const user = query.data;
  return (
    <>
      <PageHeader
        eyebrow="USER PROFILE"
        title={`Edit ${user.username ?? 'account'}`}
        description="Update contact information. Email changes require verification of the new address."
        actions={<Link to={`/admin/users/${id}`}>Cancel</Link>}
      />
      <Card>
        <Form
          key={id}
          schema={z.object({
            username:
              user.username === null
                ? z.union([z.literal(''), username])
                : username,
            email,
            phoneNumber:
              user.phoneNumber === null
                ? z.union([z.literal(''), phoneNumber])
                : phoneNumber,
          })}
          initial={{
            username: user.username ?? '',
            email: user.email,
            phoneNumber: user.phoneNumber ?? '',
          }}
          fields={[
            { name: 'username', label: 'Username' },
            { name: 'email', label: 'Email address', type: 'email' },
            { name: 'phoneNumber', label: 'Phone number', type: 'tel' },
          ]}
          onSubmit={async (data) => {
            const body = Object.fromEntries(
              Object.entries(data).filter(
                ([key, value]) =>
                  value !== (user[key as keyof AdminUser] ?? ''),
              ),
            );
            if (!Object.keys(body).length) {
              navigate(`/admin/users/${id}`);
              return;
            }
            const result = await updateUser(id, body);
            client.setQueryData([...scope, 'user', id], result);
            await client.invalidateQueries({ queryKey: scope });
            if (id === auth.user?.id) await auth.reloadUser();
            navigate(`/admin/users/${id}`, {
              replace: true,
              state: body.email ? { emailRequested: body.email } : undefined,
            });
          }}
        />
      </Card>
    </>
  );
}
export function CreateAdmin() {
  const scope = useScope();
  const client = useQueryClient();
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
    <>
      <PageHeader
        eyebrow="ADMINISTRATION"
        title="Create administrator"
        description="Give a trusted person access to manage users and permissions."
        actions={<Link to="/admin/users">Back to directory</Link>}
      />
      <div className="two-column">
        <Card>
          <Form
            schema={schema}
            submitLabel="Create administrator"
            fields={[
              { name: 'username', label: 'Username', autoComplete: 'off' },
              {
                name: 'email',
                label: 'Email address',
                type: 'email',
                autoComplete: 'off',
              },
              {
                name: 'phoneNumber',
                label: 'Phone number',
                type: 'tel',
                autoComplete: 'off',
              },
              {
                name: 'password',
                label: 'Initial password',
                type: 'password',
                autoComplete: 'new-password',
                hint: 'At least 8 characters, including a letter and a number.',
              },
              {
                name: 'confirmPassword',
                label: 'Confirm initial password',
                type: 'password',
                autoComplete: 'new-password',
              },
            ]}
            onSubmit={async ({ username, email, phoneNumber, password }) => {
              const user = await createAdmin({
                username,
                email,
                phoneNumber,
                password,
              });
              await client.invalidateQueries({ queryKey: scope });
              navigate(`/admin/users/${user.id}`, { replace: true });
            }}
          />
        </Card>
        <div className="stack">
          <Notice tone="warning" title="Immediate administrative access">
            This creates an active, email-verified administrator. It does not
            send an invitation or force a password change. Arrange a secure
            handover with the recipient.
          </Notice>
          <Card title="Administrator permissions">
            <div className="inline">
              <Users size={20} />
              <p>
                View and edit users, change roles and account status, create
                administrators, and inspect audit records.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
