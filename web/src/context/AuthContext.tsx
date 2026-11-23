import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { User } from '../types/auth';
import { apiRequest, ApiClientError } from '../api/client';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  loginStudent: (identifier: string, password: string) => Promise<User>;
  loginWarden: (identifier: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  forgotPassword: (identifier: string, reason?: string) => Promise<string>;
  refreshUser: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => setError(null);

  // Hydrate session on application mount
  const refreshUser = useCallback(async () => {
    try {
      const data = await apiRequest<{ user: User }>('/api/auth/me');
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const loginStudent = async (identifier: string, password: string): Promise<User> => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiRequest<{ user: User }>('/api/auth/student/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password }),
      });
      setUser(data.user);
      return data.user;
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : 'Login failed';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const loginWarden = async (identifier: string, password: string): Promise<User> => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiRequest<{ user: User }>('/api/auth/warden/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password }),
      });
      setUser(data.user);
      return data.user;
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : 'Login failed';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.warn('Logout error', err);
    } finally {
      setUser(null);
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string): Promise<void> => {
    setError(null);
    try {
      await apiRequest('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : 'Password update failed';
      setError(msg);
      throw err;
    }
  };

  const forgotPassword = async (identifier: string, reason?: string): Promise<string> => {
    setError(null);
    try {
      const data = await apiRequest<{ message: string }>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ identifier, reason }),
      });
      return data.message;
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : 'Failed to request password reset';
      setError(msg);
      throw err;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        error,
        loginStudent,
        loginWarden,
        logout,
        changePassword,
        forgotPassword,
        refreshUser,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
