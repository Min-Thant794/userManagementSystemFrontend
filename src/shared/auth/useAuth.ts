import { createContext, useContext } from 'react';
import type { User } from '../api/types';
export type AuthState = {
  status:
    'loading' | 'anonymous' | 'authenticated' | 'incomplete' | 'unavailable';
  user: User | null;
  epoch: number;
  error: string | null;
};
export type AuthContextValue = AuthState & {
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  reloadUser: () => Promise<User | null>;
  retrySession: () => Promise<void>;
  clearSession: (message?: string) => void;
};
export const AuthContext = createContext<AuthContextValue | null>(null);
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('AuthProvider is required');
  return context;
}
