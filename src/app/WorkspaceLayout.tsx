import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import {
  ArrowUpRight,
  CircleUserRound,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  MonitorSmartphone,
  Settings2,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../shared/auth/useAuth';
import { Avatar, Button } from '../shared/ui';
import styles from './workspace.module.css';
export function WorkspaceLayout({
  workspace,
}: {
  workspace: 'admin' | 'account';
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const admin = workspace === 'admin';
  const links = admin
    ? [
        { to: '/admin', label: 'Overview', icon: LayoutDashboard },
        { to: '/admin/users', label: 'User directory', icon: Users },
        { to: '/admin/audit-logs', label: 'Audit log', icon: ClipboardList },
      ]
    : [
        { to: '/account', label: 'Overview', icon: LayoutDashboard },
        { to: '/account/profile', label: 'My profile', icon: CircleUserRound },
        { to: '/account/email', label: 'Email address', icon: Mail },
        { to: '/account/security', label: 'Security', icon: ShieldCheck },
        {
          to: '/account/sessions',
          label: 'Devices & sessions',
          icon: MonitorSmartphone,
        },
      ];
  return (
    <div className={styles.workspace}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      {open && (
        <button
          className={styles.backdrop}
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}
      <aside className={`${styles.sidebar} ${open ? styles.open : ''}`}>
        <div className={styles.brand}>
          <ShieldCheck size={29} />
          <span>
            UMS<small>WORKSPACE</small>
          </span>
          <Button
            variant="ghost"
            className={styles.mobileClose}
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
          >
            <X size={20} />
          </Button>
        </div>
        <div className={styles.workspaceLabel}>
          {admin ? 'ADMINISTRATION' : 'PERSONAL ACCOUNT'}
        </div>
        <nav aria-label={admin ? 'Administration' : 'Account'}>
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === `/${workspace}`}
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.active : ''}`
              }
              onClick={() => setOpen(false)}
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className={styles.sidebarBottom}>
          <div className={styles.workspaceNote}>
            <ShieldCheck size={20} />
            <strong>
              {admin
                ? 'People, thoughtfully managed.'
                : 'Your account, in your hands.'}
            </strong>
            <p>
              {admin
                ? 'A clear view of your people and their access.'
                : 'Keep your details and security up to date.'}
            </p>
          </div>
          {(admin || user?.role === 'ADMIN') && (
            <Link
              className={styles.switcher}
              to={admin ? '/account' : '/admin'}
              onClick={() => setOpen(false)}
            >
              <Settings2 size={17} />
              {admin ? 'My account' : 'Admin workspace'}
              <ArrowUpRight size={15} />
            </Link>
          )}
          <button
            className={styles.signOut}
            onClick={() => {
              void logout();
              navigate('/login', { replace: true });
            }}
          >
            <LogOut size={17} />
            Sign out
          </button>
        </div>
      </aside>
      <div className={styles.main}>
        <header className={styles.topbar}>
          <div className="inline">
            <Button
              variant="ghost"
              className={styles.mobileMenu}
              onClick={() => setOpen(true)}
              aria-label="Open navigation"
              aria-expanded={open}
            >
              <Menu size={21} />
            </Button>
            <span className={styles.breadcrumb}>
              Workspace <span>/</span>{' '}
              <strong>{admin ? 'Administration' : 'My account'}</strong>
            </span>
          </div>
          <Link to="/account/profile" className={styles.identity}>
            <div>
              <strong>{user?.username ?? 'My account'}</strong>
              <small>
                {user?.role === 'ADMIN' ? 'Administrator' : 'Member'}
              </small>
            </div>
            <Avatar name={user?.username} src={user?.profileImageUrl} />
          </Link>
        </header>
        <main id="main-content" className={styles.content}>
          <Outlet />
        </main>
        <footer className={styles.footer}>
          UMS Workspace <span>Account management, made clear.</span>
        </footer>
      </div>
    </div>
  );
}
