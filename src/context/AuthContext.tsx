import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiAuth, User } from '../api';
import { resetOnboarding } from '../utils/consent';
import { getDeviceId } from '../utils/device';
import { initRevenueCat, loginRevenueCat, logoutRevenueCat } from '../lib/revenuecat';
import { identifySentry, initSentry, resetSentry } from '../lib/sentry';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  guest: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, phone?: string) => Promise<void>;
  startGuest: () => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [guest, setGuest] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const bootstrap = async () => {
      const stored = await AsyncStorage.getItem('auth_token');
      if (stored) {
        setToken(stored);
        try {
          const me = await apiAuth.me();
          const userResult = me.data.data;
          setUser(userResult);
          initSentry();
          identifySentry(userResult || {});
          await initRevenueCat();
          await loginRevenueCat(userResult?.id);
        } catch (e) {
          if ((e as any)?.response?.status === 401) {
            await AsyncStorage.removeItem('auth_token');
          }
        }
      }
      if (!stored) {
        const guestFlag = await AsyncStorage.getItem('guest_mode');
        setGuest(guestFlag === 'true');
      }
      setLoading(false);
    };
    bootstrap();
  }, []);

  const clearGuestMode = async () => {
    await AsyncStorage.removeItem('guest_mode');
    setGuest(false);
  };

  const handleAuthSuccess = async (accessToken: string | null | undefined) => {
    if (!accessToken) {
      throw new Error('Login failed. Please check your details and try again.');
    }
    await AsyncStorage.setItem('auth_token', accessToken);
    await clearGuestMode();
    setToken(accessToken);
    let userData: User | null = null;
    try {
      const me = await apiAuth.me();
      userData = me.data.data;
      setUser(userData);
      initSentry();
      identifySentry(userData || {});
    } catch (e) {
      if ((e as any)?.response?.status === 401) {
        await AsyncStorage.removeItem('auth_token');
        setUser(null);
        setToken(null);
      }
    }
    await initRevenueCat();
    await loginRevenueCat(userData?.id);
  };

  const login = async (email: string, password: string) => {
    await clearGuestMode();
    const deviceId = await getDeviceId();
    const res = await apiAuth.login(email, password, deviceId);
    await handleAuthSuccess(res.data.data?.accessToken);
  };

  const register = async (email: string, password: string, name: string, phone?: string) => {
    await clearGuestMode();
    const deviceId = await getDeviceId();
    const res = await apiAuth.register(email, password, name, phone, deviceId);
    await handleAuthSuccess(res.data.data?.accessToken);
  };

  const startGuest = async () => {
    await AsyncStorage.setItem('guest_mode', 'true');
    await AsyncStorage.removeItem('auth_token');
    setGuest(true);
    setUser(null);
    setToken(null);
    resetSentry();
  };

  const logout = async () => {
    await logoutRevenueCat();
    await AsyncStorage.removeItem('auth_token');
    await AsyncStorage.removeItem('guest_mode');
    await resetOnboarding();
    setUser(null);
    setToken(null);
    setGuest(false);
    resetSentry();
  };

  const refresh = async () => {
    if (!token) return;
    const me = await apiAuth.me();
    setUser(me.data.data);
  };

  return (
    <AuthContext.Provider value={{ user, token, guest, loading, login, register, startGuest, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
