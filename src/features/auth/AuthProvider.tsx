import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  AuthContext,
  type AuthContextValue,
  type AuthState,
} from '../../shared/auth/useAuth';
import { session } from '../../shared/auth/session';
import { api, ApiError, onAccessIssue } from '../../shared/api/client';
import type { User } from '../../shared/api/types';
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({
    status: 'loading',
    user: null,
    epoch: 0,
    error: null,
  });
  const actions = useMemo(() => {
    let bootstrap: Promise<void> | null = null;
    let hydration: Promise<User | null> | null = null;
    let identity: User | null = null;
    const reset = (message?: string) => {
      hydration = null;
      identity = null;
      void queryClient.cancelQueries();
      queryClient.clear();
      setState((old) => ({
        status: 'anonymous',
        user: null,
        epoch: old.epoch + 1,
        error: message ?? null,
      }));
    };
    const reloadUser = (): Promise<User | null> => {
      if (hydration) return hydration;
      const version = session.version;
      const operation = api<User>('/api/users/me')
        .then((user) => {
          if (version !== session.version) return null;
          const changed =
            identity !== null &&
            (identity.id !== user.id || identity.role !== user.role);
          identity = user;
          if (changed) {
            session.invalidateWork();
            void queryClient.cancelQueries();
            queryClient.clear();
          }
          setState((old) => ({
            status: 'authenticated',
            user,
            epoch: changed ? old.epoch + 1 : old.epoch,
            error: null,
          }));
          return user;
        })
        .catch((error) => {
          if (error instanceof DOMException && error.name === 'AbortError')
            return null;
          if (version !== session.version) return null;
          if (
            error instanceof ApiError &&
            error.action === 'complete_profile'
          ) {
            setState((old) => ({
              ...old,
              status: 'incomplete',
              user: null,
              error: null,
            }));
            return null;
          }
          if (
            error instanceof ApiError &&
            [400, 401, 403].includes(error.status)
          ) {
            session.clear(
              error.status === 403
                ? error.message
                : 'Your session ended. Please sign in again.',
            );
            return null;
          }
          setState((old) => ({
            ...old,
            status: 'unavailable',
            user: null,
            error:
              error instanceof Error
                ? error.message
                : 'The service is unavailable.',
          }));
          throw error;
        })
        .finally(() => {
          if (hydration === operation) hydration = null;
        });
      hydration = operation;
      return operation;
    };
    const retrySession = () => {
      if (bootstrap) return bootstrap;
      setState((old) => ({
        ...old,
        status: 'loading',
        user: null,
        error: null,
      }));
      const operation = session
        .refresh()
        .then(() => reloadUser())
        .then(() => {})
        .catch((error) => {
          if (error instanceof DOMException && error.name === 'AbortError')
            return;
          if (
            error instanceof ApiError &&
            [400, 401, 403].includes(error.status)
          ) {
            reset(error.status === 403 ? error.message : undefined);
            return;
          }
          setState((old) => ({
            ...old,
            status: 'unavailable',
            user: null,
            error:
              error instanceof Error
                ? error.message
                : 'The service is unavailable.',
          }));
        })
        .finally(() => {
          if (bootstrap === operation) bootstrap = null;
        });
      bootstrap = operation;
      return operation;
    };
    return {
      reset,
      reloadUser,
      retrySession,
      login: async (identifier: string, password: string) => {
        await session.login(identifier, password);
        await reloadUser();
      },
      logout: async () => {
        try {
          await session.logout();
        } catch {
          reset(
            'This browser was cleared, but server sign-out could not be confirmed. Retry sign-out before leaving a shared device.',
          );
        }
      },
      clearSession: (message?: string) => session.clear(message),
    };
  }, [queryClient]);
  useEffect(() => {
    const unsubscribe = session.subscribe((event) => {
      if (event.type === 'clear') actions.reset(event.message);
      else if (event.external) {
        void actions.reloadUser().catch(() => {});
      }
    });
    onAccessIssue((error, path) => {
      if (error.action === 'complete_profile') {
        setState((old) => ({ ...old, status: 'incomplete', user: null }));
        return;
      }
      if (error.title === 'Account Suspended') {
        session.clear(error.message);
        return;
      }
      if (path.startsWith('/api/admin/'))
        void actions.reloadUser().catch(() => {});
    });
    if (location.pathname !== '/oauth2/callback') void actions.retrySession();
    return unsubscribe;
  }, [actions]);
  const value: AuthContextValue = { ...state, ...actions };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
