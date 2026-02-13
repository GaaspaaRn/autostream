import { useState, useEffect, useCallback, useContext, createContext } from 'react';
import type { AuthState } from '../types';

const API_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:3001';

interface ApiContextType extends AuthState {
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<boolean>;
}

const AuthContext = createContext<ApiContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(() => {
    const stored = localStorage.getItem('auth') || sessionStorage.getItem('auth');
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        user: parsed.user,
        token: parsed.tokens.accessToken,
        isAuthenticated: true,
      };
    }
    return { user: null, token: null, isAuthenticated: false };
  });

  const login = async (email: string, password: string, rememberMe = false) => {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, rememberMe }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Erro ao fazer login');
    }

    const storage = rememberMe ? localStorage : sessionStorage;
    storage.setItem('auth', JSON.stringify(result.data));

    setAuth({
      user: result.data.user,
      token: result.data.tokens.accessToken,
      isAuthenticated: true,
    });
  };

  const logout = () => {
    localStorage.removeItem('auth');
    sessionStorage.removeItem('auth');
    setAuth({ user: null, token: null, isAuthenticated: false });
  };

  const refreshToken = async (): Promise<boolean> => {
    const stored = localStorage.getItem('auth') || sessionStorage.getItem('auth');
    if (!stored) return false;

    const parsed = JSON.parse(stored);

    try {
      const response = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: parsed.tokens.refreshToken }),
      });

      const result = await response.json();

      if (!response.ok) {
        logout();
        return false;
      }

      parsed.tokens.accessToken = result.data.accessToken;
      const storage = localStorage.getItem('auth') ? localStorage : sessionStorage;
      storage.setItem('auth', JSON.stringify(parsed));

      setAuth({
        user: parsed.user,
        token: result.data.accessToken,
        isAuthenticated: true,
      });

      return true;
    } catch {
      logout();
      return false;
    }
  };

  return (
    <AuthContext.Provider value={{ ...auth, login, logout, refreshToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || 'Erro na requisição');
  }

  return result.data || result;
}

export function useApi<T>(endpoint: string, options: { immediate?: boolean } = { immediate: true }) {
  const { token, refreshToken } = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const result = await apiRequest<T>(endpoint, {}, token);
      setData(result);
    } catch (err: any) {
      if (err.message === 'Token expirado') {
        const refreshed = await refreshToken();
        if (refreshed) {
          return fetchData();
        }
      }
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [endpoint, token]);

  useEffect(() => {
    if (options.immediate) {
      fetchData();
    }
  }, [fetchData, options.immediate]);

  return { data, loading, error, refetch: fetchData };
}