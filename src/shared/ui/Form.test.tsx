import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { z } from 'zod';
import { Form } from './Form';
import { ApiError } from '../api/client';
const schema = z.object({ email: z.string().email('Enter a valid email.') });
afterEach(cleanup);
function setup(submit: (data: Record<string, string>) => Promise<void>) {
  const router = createMemoryRouter([
    {
      path: '/',
      element: (
        <Form
          guard={false}
          schema={schema}
          fields={[{ name: 'email', label: 'Email address', type: 'email' }]}
          onSubmit={submit}
        />
      ),
    },
  ]);
  render(<RouterProvider router={router} />);
  return userEvent.setup();
}
describe('form behavior', () => {
  it('validates locally before sending an API request', async () => {
    const submit = vi.fn();
    const user = setup(submit);
    await user.type(screen.getByLabelText('Email address'), 'invalid');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Enter a valid email.')).toBeVisible();
    expect(submit).not.toHaveBeenCalled();
  });
  it('retains a draft after a backend conflict', async () => {
    const user = setup(
      vi
        .fn()
        .mockRejectedValue(
          new ApiError(409, 'Duplicate Resource', 'Email already exists'),
        ),
    );
    await user.type(
      screen.getByLabelText('Email address'),
      'member@example.test',
    );
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Email already exists',
    );
    expect(screen.getByLabelText('Email address')).toHaveValue(
      'member@example.test',
    );
  });
  it('prevents repeated submission while a request is pending', async () => {
    let finish: () => void = () => {};
    const submit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const user = setup(submit);
    await user.type(
      screen.getByLabelText('Email address'),
      'member@example.test',
    );
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    finish();
  });
});
