import { z } from 'zod';
export const roleSchema = z.enum(['USER', 'ADMIN']);
export const statusSchema = z.enum(['ACTIVE', 'SUSPENDED']);
const nullableText = z.string().nullable();
export const userSchema = z.object({
  id: z.string(),
  username: nullableText,
  email: z.string(),
  pendingEmail: nullableText,
  phoneNumber: nullableText,
  role: roleSchema,
  profileImageUrl: nullableText,
});
export const adminUserSchema = z.object({
  id: z.string(),
  username: nullableText,
  email: z.string(),
  phoneNumber: nullableText,
  role: roleSchema,
  status: statusSchema,
  emailVerified: z.boolean(),
  failedLoginAttempts: z.number(),
  lockedUntil: nullableText,
  profileComplete: z.boolean(),
  profileImageUrl: nullableText,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export const auditSchema = z.object({
  id: z.number(),
  actorUserId: nullableText,
  targetUserId: nullableText,
  action: z.enum([
    'ROLE_CHANGE',
    'SUSPEND',
    'REACTIVATE',
    'UPDATE',
    'ADMIN_CREATED',
  ]),
  details: z.record(z.unknown()),
  createdAt: z.string(),
});
export const sessionSchema = z.object({
  id: z.number(),
  device: z.string(),
  location: z.string(),
  lastUsedAt: z.string(),
  createdAt: z.string(),
  current: z.boolean(),
});
export const tokensSchema = z.object({
  accessToken: z.string().min(1),
  tokenType: z.literal('Bearer'),
  expiresIn: z.number().positive(),
});
export const pageSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    content: z.array(item),
    page: z.object({
      size: z.number().int().nonnegative(),
      number: z.number().int().nonnegative(),
      totalElements: z.number().int().nonnegative(),
      totalPages: z.number().int().nonnegative(),
    }),
  });
export type Role = z.infer<typeof roleSchema>;
export type AccountStatus = z.infer<typeof statusSchema>;
export type User = z.infer<typeof userSchema>;
export type AdminUser = z.infer<typeof adminUserSchema>;
export type AuditLog = z.infer<typeof auditSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type AuthTokens = z.infer<typeof tokensSchema>;
export type Page<T> = {
  content: T[];
  page: {
    size: number;
    number: number;
    totalElements: number;
    totalPages: number;
  };
};
