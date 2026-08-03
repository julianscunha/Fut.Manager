import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { User } from '../types/domain';
import { apiClient } from '../api/client';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: Error | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setToken: (token: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Initialize auth from storage
  useEffect(() => {
    const storedToken = localStorage.getItem('racha_token');
    const storedUser = localStorage.getItem('racha_user');
    
    if (storedToken && storedUser) {
      try {
        setTokenState(storedToken);
        apiClient.setToken(storedToken);
        setUser(JSON.parse(storedUser));
      } catch (err) {
        // Invalid stored data, clear it
        localStorage.removeItem('racha_token');
        localStorage.removeItem('racha_user');
      }
    }
    
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        throw new Error('Login failed');
      }

      const data = await response.json() as { token: string; user: User };
      
      setTokenState(data.token);
      setUser(data.user);
      
      localStorage.setItem('racha_token', data.token);
      localStorage.setItem('racha_user', JSON.stringify(data.user));
      
      apiClient.setToken(data.token);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setTokenState(null);
    apiClient.clearAuth();
    localStorage.removeItem('racha_token');
    localStorage.removeItem('racha_user');
  }, []);

  const setToken = useCallback((newToken: string) => {
    setTokenState(newToken);
    apiClient.setToken(newToken);
    localStorage.setItem('racha_token', newToken);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, error, login, logout, setToken }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access auth context
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
