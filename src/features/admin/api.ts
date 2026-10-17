import { api } from '../../shared/api/client';
import type { AdminUser, AuditLog, Page } from '../../shared/api/types';
export type Filters = Record<string, string | number | undefined>;
function query(params: Filters) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') search.set(key, String(value));
  });
  return search.toString();
}
export const listUsers = (params: Filters, signal?: AbortSignal) =>
  api<Page<AdminUser>>(`/api/admin/users?${query(params)}`, { signal });
export const getUser = (id: string, signal?: AbortSignal) =>
  api<AdminUser>(`/api/admin/users/${encodeURIComponent(id)}`, { signal });
export const updateUser = (id: string, body: Record<string, string>) =>
  api<AdminUser>(`/api/admin/users/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body,
  });
export const changeAccess = (
  id: string,
  kind: 'role' | 'status',
  value: string,
) =>
  api<AdminUser>(`/api/admin/users/${encodeURIComponent(id)}/${kind}`, {
    method: 'PATCH',
    body: { [kind]: value },
  });
export const createAdmin = (body: Record<string, string>) =>
  api<AdminUser>('/api/admin/users', { method: 'POST', body });
export const listAudit = (params: Filters, signal?: AbortSignal) =>
  api<Page<AuditLog>>(`/api/admin/audit-logs?${query(params)}`, { signal });
