import React, { createContext, useState, useContext, useEffect } from 'react';
import {
  login as apiLogin,
  signup as apiSignup,
  loginWithGoogle as apiLoginWithGoogle,
  logout as apiLogout,
  fetchCurrentUser,
} from '../api/authApi';
import { persistSession, clearSessionStorage, getStoredAccessToken } from '../utils/authFetch';
import { unreachableBackendHint } from '../config/apiOrigin';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = getStoredAccessToken();
        const storedUser = localStorage.getItem('parkgo_user');
        if (storedUser && token) {
          try {
            setUser(JSON.parse(storedUser));
          } catch {
            /* ignore corrupt cache */
          }
        }
        if (token) {
          const me = await fetchCurrentUser();
          if (!cancelled) {
            if (me) {
              setUser(me);
              persistSession({ user: me });
            } else {
              clearSessionStorage();
              setUser(null);
            }
          }
        } else if (!cancelled) {
          clearSessionStorage();
          setUser(null);
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onRefresh = (e) => {
      if (e && e.detail) setUser(e.detail);
    };
    if (typeof window === 'undefined') return undefined;
    window.addEventListener('parkgo-auth-refresh', onRefresh);
    return () => window.removeEventListener('parkgo-auth-refresh', onRefresh);
  }, []);

  const login = async (usernameOrEmail, password, options = {}) => {
    try {
      const result = await apiLogin(usernameOrEmail, password, options);
      if (!result.success) return result;
      setUser(result.user);
      return result;
    } catch (err) {
      const msg = err.message || 'Network error';
      const friendly =
        msg === 'Failed to fetch' || msg.includes('NetworkError') ? unreachableBackendHint() : msg;
      return { success: false, error: friendly };
    }
  };

  const signup = async (userData) => {
    try {
      const result = await apiSignup(userData);
      if (!result.success) return result;
      // Signup does not issue tokens — user must log in before protected routes.
      return result;
    } catch (err) {
      return { success: false, error: err.message || 'Network error' };
    }
  };

  const loginWithGoogle = async (credential, options = {}) => {
    try {
      const result = await apiLoginWithGoogle(credential, options);
      if (!result.success) return result;
      setUser(result.user);
      return result;
    } catch (err) {
      return { success: false, error: err.message || 'Network error' };
    }
  };

  const logout = async () => {
    await apiLogout();
    setUser(null);
  };

  const value = {
    user,
    login,
    loginWithGoogle,
    signup,
    logout,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
