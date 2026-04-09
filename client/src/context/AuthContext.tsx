import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { api, setToken, clearToken, type AuthIdentity } from '@/api/client';

interface AuthState {
  user: AuthIdentity | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password?: string) => Promise<void>;
  clientLogin: (email: string, password?: string) => Promise<void>;
  logout: () => void;
  isClient: boolean;
  isStaff: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  // Check existing session on mount
  useEffect(() => {
    api
      .getMe()
      .then((user) => {
        setState({ user, isLoading: false, isAuthenticated: true });
      })
      .catch(() => {
        setState({ user: null, isLoading: false, isAuthenticated: false });
      });
  }, []);

  const login = useCallback(async (email: string, password = '') => {
    const result = await api.login(email, password);
    setToken(result.token);
    setState({ user: result.user, isLoading: false, isAuthenticated: true });
  }, []);

  const clientLogin = useCallback(async (email: string, password = '') => {
    const result = await api.clientLogin(email, password);
    setToken(result.token);
    setState({ user: result.client, isLoading: false, isAuthenticated: true });
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setState({ user: null, isLoading: false, isAuthenticated: false });
  }, []);

  const isClient = state.user?.role === 'client';
  const isStaff = !!state.user && state.user.role !== 'client';

  return (
    <AuthContext.Provider value={{ ...state, login, clientLogin, logout, isClient, isStaff }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
