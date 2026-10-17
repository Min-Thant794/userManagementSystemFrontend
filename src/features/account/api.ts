import { api } from '../../shared/api/client';
import type { Session, User } from '../../shared/api/types';
export const updateProfile = (body: Record<string, string>) =>
  api<User>('/api/users/me', { method: 'PATCH', body });
export const updatePassword = (
  body: Record<string, string>,
  initial: boolean,
) =>
  api<void>(`/api/users/me/password${initial ? '/initial' : ''}`, {
    method: 'PUT',
    body,
  });
export const uploadPhoto = (file: File) => {
  const body = new FormData();
  body.append('file', file);
  return api<User>('/api/users/me/photo', { method: 'PUT', body });
};
export const removePhoto = () =>
  api<User>('/api/users/me/photo', { method: 'DELETE' });
export const listSessions = (signal?: AbortSignal) =>
  api<Session[]>('/api/auth/sessions', { signal });
export const revokeSession = (id: number | 'others') =>
  api<void>(`/api/auth/sessions/${id}`, { method: 'DELETE' });
