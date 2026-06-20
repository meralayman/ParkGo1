import { apiPost, apiGet } from './client';
import { persistSession, clearSessionStorage } from '../utils/authFetch';

export async function login(usernameOrEmail, password, options = {}) {
  const body = { usernameOrEmail, password };
  if (options.intendedRole) body.intendedRole = options.intendedRole;
  const res = await apiPost('/auth/login', body, false);
  if (!res.ok) {
    return {
      success: false,
      error: res.error,
      locked: res.data?.locked === true || res.status === 429,
      lockoutSeconds: res.data?.lockoutSeconds,
      code: res.data?.code,
    };
  }
  const data = res.data;
  persistSession({
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    user: data.user,
  });
  return { success: true, user: data.user };
}

export async function signup(userData) {
  const res = await apiPost(
    '/auth/signup',
    {
      firstName: userData.firstName,
      lastName: userData.lastName,
      phoneNumber: userData.phoneNumber,
      nationalId: userData.nationalId,
      username: userData.username,
      email: userData.gmail,
      password: userData.password,
      role: userData.role || 'user',
    },
    false
  );
  if (!res.ok) return { success: false, error: res.error };
  return { success: true, user: res.data.user };
}

export async function loginWithGoogle(credential, options = {}) {
  const body = { credential };
  if (options.intendedRole) body.intendedRole = options.intendedRole;
  const res = await apiPost('/auth/google', body, false);
  if (!res.ok) return { success: false, error: res.error };
  persistSession({
    accessToken: res.data.accessToken,
    refreshToken: res.data.refreshToken,
    user: res.data.user,
  });
  return { success: true, user: res.data.user };
}

export async function fetchCurrentUser() {
  const res = await apiGet('/auth/me');
  if (!res.ok) return null;
  return res.data.user || null;
}

export async function logout() {
  const refresh = localStorage.getItem('refreshToken');
  const access = localStorage.getItem('accessToken');
  try {
    await apiPost(
      '/auth/logout',
      { refreshToken: refresh },
      Boolean(access)
    );
  } catch {
    /* still clear local session */
  }
  clearSessionStorage();
}
