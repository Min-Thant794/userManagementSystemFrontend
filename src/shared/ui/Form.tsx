import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { useBlocker } from 'react-router';
import { ApiError } from '../api/client';
import { Button, ConfirmDialog, Field, Notice } from './index';
export type FormField = {
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
  hint?: string;
  disabled?: boolean;
};
export function Form({
  schema,
  fields,
  initial = {},
  submitLabel = 'Save changes',
  onSubmit,
  children,
  guard = true,
}: {
  schema: z.ZodType<Record<string, string>>;
  fields: FormField[];
  initial?: Record<string, string>;
  submitLabel?: string;
  onSubmit: (data: Record<string, string>) => Promise<void>;
  children?: React.ReactNode;
  guard?: boolean;
}) {
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<Record<string, string>>({
    resolver: zodResolver(schema),
    defaultValues: initial,
  });
  const [failure, setFailure] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const blocker = useBlocker(guard && isDirty && !isSubmitting && !saved);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  useEffect(() => {
    if (!guard || !isDirty || saved) return;
    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, [guard, isDirty, saved]);
  return (
    <>
      <form
        className="stack"
        noValidate
        onChange={() => setSaved(false)}
        onSubmit={handleSubmit(async (values) => {
          setFailure(null);
          try {
            await onSubmit(values);
            fields
              .filter((field) => field.type === 'password')
              .forEach((field) =>
                setValue(field.name, '', { shouldDirty: false }),
              );
            setSaved(true);
          } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError')
              return;
            if (error instanceof ApiError) {
              if (
                guard &&
                (['network', 'timeout', 'contract'].includes(error.kind) ||
                  error.status >= 500)
              )
                setUncertain(true);
              Object.entries(error.fieldErrors).forEach(([name, message]) =>
                setError(name, { message }),
              );
              if (error.status === 429)
                setCooldown(Math.ceil(error.retryAfterSeconds ?? 60));
            }
            setFailure(
              error instanceof Error
                ? error.message
                : 'The request could not be completed.',
            );
          }
        })}
      >
        {fields.map((field) => (
          <Field
            key={field.name}
            label={field.label}
            error={errors[field.name]?.message as string | undefined}
            hint={field.hint}
          >
            <input
              {...register(field.name)}
              type={field.type ?? 'text'}
              autoComplete={field.autoComplete}
              disabled={isSubmitting || field.disabled}
            />
          </Field>
        ))}
        {failure && <Notice tone="error">{failure}</Notice>}
        {uncertain && (
          <Notice tone="warning">
            The change may have reached the server. Reload the current data
            before submitting again.{' '}
            <Button
              variant="secondary"
              onClick={() => window.location.reload()}
            >
              Reload current data
            </Button>
          </Notice>
        )}
        {children}
        <div className="form-actions">
          <Button
            type="submit"
            busy={isSubmitting}
            disabled={cooldown > 0 || uncertain}
          >
            {cooldown > 0 ? `Try again in ${cooldown}s` : submitLabel}
          </Button>
        </div>
      </form>
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        title="Leave unsaved changes?"
        description="Your changes on this page have not been saved."
        confirmLabel="Leave page"
        onConfirm={() => blocker.proceed?.()}
        onClose={() => blocker.reset?.()}
      />
    </>
  );
}
