import { describe, expect, it } from 'vitest';
import { safeReturnPath } from './routing';
import { validateApiOrigin } from '../api/config';
import { password, phoneNumber, username } from '../api/validation';
describe('authorization-aware return routes', () => {
  it.each([
    'https://evil.invalid',
    '//evil.invalid',
    '/\\evil.invalid',
    '/admin/users',
    '/login',
    '/account/../../admin',
  ])('keeps a member away from unsafe destinations: %s', (path) =>
    expect(safeReturnPath(path, 'USER')).toBe('/account'),
  );
  it('preserves an authorized deep link', () =>
    expect(safeReturnPath('/admin/users?page=2', 'ADMIN')).toBe(
      '/admin/users?page=2',
    ));
  it('lets administrators use personal routes', () =>
    expect(safeReturnPath('/account/security', 'ADMIN')).toBe(
      '/account/security',
    ));
});
describe('environment and field validation', () => {
  it('accepts a same-origin deployment', () =>
    expect(validateApiOrigin('', true)).toBe(''));
  it.each([
    'http://localhost:8080',
    'https://api.example.com/api',
    'https://user:pass@example.com',
    'not a url',
  ])('rejects invalid production origins: %s', (value) =>
    expect(() => validateApiOrigin(value, true)).toThrow(),
  );
  it('matches server password rules without extra complexity requirements', () => {
    expect(password.safeParse('password1').success).toBe(true);
    expect(password.safeParse('password').success).toBe(false);
  });
  it('validates usernames and phone numbers', () => {
    expect(username.safeParse('valid_user').success).toBe(true);
    expect(username.safeParse('has space').success).toBe(false);
    expect(phoneNumber.safeParse('+6591234567').success).toBe(true);
  });
});
