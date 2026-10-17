import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Info,
  LoaderCircle,
  ShieldCheck,
  X,
} from 'lucide-react';
import { Link } from 'react-router';
import styles from './ui.module.css';
export function Button({
  variant = 'primary',
  busy = false,
  children,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  busy?: boolean;
}) {
  return (
    <button
      {...props}
      type={type}
      disabled={props.disabled || busy}
      aria-busy={busy || undefined}
      className={`${styles.button} ${styles[variant]} ${props.className ?? ''}`}
    >
      {busy && <LoaderCircle size={16} className="spin" />}
      {children}
    </button>
  );
}
export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  const generatedId = useId();
  const child = Children.only(children);
  const id = isValidElement<InputHTMLAttributes<HTMLInputElement>>(child)
    ? (child.props.id ?? generatedId)
    : generatedId;
  const control = isValidElement<InputHTMLAttributes<HTMLInputElement>>(child)
    ? cloneElement(child, {
        id,
        'aria-invalid': Boolean(error),
        'aria-describedby': error
          ? `${id}-error`
          : hint
            ? `${id}-hint`
            : undefined,
      })
    : child;
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      {control}
      {hint && (
        <small id={`${id}-hint`} className="muted">
          {hint}
        </small>
      )}
      {error && (
        <small id={`${id}-error`} className={styles.fieldError}>
          {error}
        </small>
      )}
    </div>
  );
}
export function Notice({
  children,
  tone = 'info',
  title,
}: {
  children: ReactNode;
  tone?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
}) {
  const Icon =
    tone === 'success' ? CheckCircle2 : tone === 'error' ? AlertCircle : Info;
  return (
    <div
      className={`${styles.notice} ${styles[tone]}`}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <Icon size={19} />
      <div>
        {title && <strong>{title}</strong>}
        <div>{children}</div>
      </div>
    </div>
  );
}
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className={styles.pageHeader}>
      <div>
        {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {actions && <div className="form-actions">{actions}</div>}
    </header>
  );
}
export function Card({
  children,
  title,
  description,
  className = '',
}: {
  children: ReactNode;
  title?: string;
  description?: string;
  className?: string;
}) {
  return (
    <section className={`${styles.card} ${className}`}>
      {(title || description) && (
        <header className={styles.cardHeader}>
          {title && <h2>{title}</h2>}
          {description && <p className="muted">{description}</p>}
        </header>
      )}
      {children}
    </section>
  );
}
export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className={styles.empty} role="status">
      <LoaderCircle className="spin" size={24} />
      <p>{label}</p>
    </div>
  );
}
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className={styles.empty}>
      <div className={styles.emptyIcon}>
        <Info size={24} />
      </div>
      <h3>{title}</h3>
      {description && <p className="muted">{description}</p>}
      {action}
    </div>
  );
}
export function ErrorState({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  return (
    <Notice tone="error" title="Something needs attention">
      <p>
        {error instanceof Error
          ? error.message
          : 'The request could not be completed.'}
      </p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </Notice>
  );
}
export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'success' | 'warning' | 'neutral' | 'danger';
}) {
  return <span className={`${styles.badge} ${styles[tone]}`}>{children}</span>;
}
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  busy = false,
  danger = false,
  onConfirm,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  busy?: boolean;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className={styles.dialogHead}>
        <h2 id={titleId}>{title}</h2>
        <Button
          variant="ghost"
          aria-label="Close dialog"
          disabled={busy}
          onClick={onClose}
        >
          <X size={18} />
        </Button>
      </div>
      <p id={descriptionId} className="muted">
        {description}
      </p>
      {children}
      <div className="form-actions">
        <Button variant="secondary" disabled={busy} onClick={onClose} autoFocus>
          Cancel
        </Button>
        <Button
          variant={danger ? 'danger' : 'primary'}
          busy={busy}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
export function Pagination({
  page,
  totalPages,
  totalElements,
  size,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  totalElements: number;
  size: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <nav className={styles.pagination} aria-label="Pagination">
      <p className="muted">
        {totalElements
          ? `${page * size + 1}–${Math.min((page + 1) * size, totalElements)} of ${totalElements}`
          : '0 results'}
      </p>
      <div className="inline">
        <Button
          variant="secondary"
          disabled={page <= 0}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          <ArrowLeft size={16} />
        </Button>
        <span>
          Page {totalPages ? page + 1 : 0} of {totalPages}
        </span>
        <Button
          variant="secondary"
          disabled={page + 1 >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          <ArrowRight size={16} />
        </Button>
      </div>
    </nav>
  );
}
export function Avatar({
  name,
  src,
  size = 'md',
}: {
  name?: string | null;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <span className={`${styles.avatar} ${styles[size]}`}>
      {src && /^https?:\/\//.test(src) ? (
        <img src={src} alt="" referrerPolicy="no-referrer" />
      ) : (
        (name?.slice(0, 2).toUpperCase() ?? 'UM')
      )}
    </span>
  );
}
export function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
}
export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className={styles.auth}>
      <aside className={styles.authAside}>
        <Link className={styles.brand} to="/login">
          <ShieldCheck size={28} /> UMS<span>Workspace</span>
        </Link>
        <div>
          <p className={styles.eyebrow}>ONE ACCOUNT. YOUR WORKSPACE.</p>
          <h2>
            A thoughtful space
            <br />
            for people & access.
          </h2>
          <p>
            Manage your account. Keep your details up to date.
            <br />
            Stay in control of where you sign in.
          </p>
          <div className={styles.authGraphic} aria-hidden="true">
            <div>
              <ShieldCheck size={36} />
              <span>Built around your identity</span>
            </div>
            <span>Profile</span>
            <span>Security</span>
            <span>Access</span>
          </div>
        </div>
        <small>User Management System</small>
      </aside>
      <section className={styles.authContent}>
        <div className={styles.authForm}>
          <Link className={styles.mobileBrand} to="/login">
            <ShieldCheck /> UMS Workspace
          </Link>
          <p className={styles.eyebrow}>YOUR ACCOUNT</p>
          <h1>{title}</h1>
          {description && <p className="muted">{description}</p>}
          <div className={styles.authBody}>{children}</div>
          {footer && <div className={styles.authFooter}>{footer}</div>}
        </div>
        <small className="muted">
          Your profile. Your security. One workspace.
        </small>
      </section>
    </main>
  );
}
