import { createContext, useContext, useState, type ReactNode } from 'react';
import { api, setAuthToken } from '../services/api.ts';
import type { User } from '../types/index.ts';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (payload: {
    name: string;
    email: string;
    password: string;
    department: string;
  }) => Promise<User>;
  demoLogin: () => Promise<User>;
  claimAdmin: (payload: { name: string; email: string; password: string }) => Promise<User>;
  passcodeAdminLogin: (passcode: string) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const applySession = (nextToken: string, nextUser: User) => {
    setAuthToken(nextToken);
    setToken(nextToken);
    setUser(nextUser);
    return nextUser;
  };

  const login = async (email: string, password: string) => {
    const res = await api.post<{ token: string; user: User }>('/auth/login', { email, password });
    return applySession(res.data.token, res.data.user);
  };

  const register = async (payload: {
    name: string;
    email: string;
    password: string;
    department: string;
  }) => {
    const res = await api.post<{ token: string; user: User }>('/auth/register', payload);
    return applySession(res.data.token, res.data.user);
  };

  const demoLogin = async () => {
    const res = await api.post<{ token: string; user: User }>('/auth/demo');
    return applySession(res.data.token, res.data.user);
  };

  const claimAdmin = async (payload: { name: string; email: string; password: string }) => {
    const res = await api.post<{ token: string; user: User }>('/auth/claim-admin', payload);
    return applySession(res.data.token, res.data.user);
  };

  const passcodeAdminLogin = async (passcode: string) => {
    const res = await api.post<{ token: string; user: User }>('/auth/admin-passcode', { passcode });
    return applySession(res.data.token, res.data.user);
  };

  const logout = () => {
    setAuthToken(null);
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: Boolean(user && token),
        isAdmin: user?.role === 'admin',
        login,
        register,
        demoLogin,
        claimAdmin,
        passcodeAdminLogin,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
