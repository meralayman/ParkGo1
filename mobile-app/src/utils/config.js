import Constants from 'expo-constants';
import { Platform } from 'react-native';

const DEFAULT_PORT = 5000;
const ANDROID_EMULATOR_HOST = `http://10.0.2.2:${DEFAULT_PORT}`;
const IOS_SIMULATOR_HOST = `http://127.0.0.1:${DEFAULT_PORT}`;

function normalizeUrl(v) {
  return typeof v === 'string' && v.trim() ? v.trim().replace(/\/$/, '') : null;
}

function fromExpoPublicEnv() {
  return normalizeUrl(process.env.EXPO_PUBLIC_API_BASE_URL);
}

function fromLanHostEnv() {
  const raw = process.env.EXPO_PUBLIC_API_LAN_HOST;
  if (!raw || !String(raw).trim()) return null;
  let host = String(raw).trim().replace(/\/$/, '');
  if (/^https?:\/\//i.test(host)) return host.replace(/\/$/, '');
  if (!host.includes(':')) host = `${host}:${DEFAULT_PORT}`;
  return `http://${host}`;
}

function extra() {
  return Constants?.expoConfig?.extra || {};
}

/** PC LAN URL — physical phone / iOS on Wi‑Fi. */
function fromExpoExtraLan() {
  const e = extra();
  return normalizeUrl(e.apiBaseUrlLan || e.apiBaseUrl || e.API_BASE_URL);
}

/** Android emulator → host machine (10.0.2.2). */
function fromExpoExtraAndroidEmulator() {
  const e = extra();
  return normalizeUrl(e.apiBaseUrlAndroidEmulator) || ANDROID_EMULATOR_HOST;
}

function isAndroidEmulatorLoopback(url) {
  return Boolean(url && /\/\/10\.0\.2\.2(?::|$)/.test(url));
}

function isDeviceLocalhost(url) {
  return Boolean(url && /\/\/(localhost|127\.0\.0\.1)(?::|$)/i.test(url));
}

function isLanStyleUrl(url) {
  if (!url || isDeviceLocalhost(url) || isAndroidEmulatorLoopback(url)) return false;
  return /\/\/192\.168\.|\/\/10\.|\/\/172\.(1[6-9]|2\d|3[01])\./.test(url);
}

/** false = simulator / emulator (Expo Go on AVD). */
function isPhysicalDevice() {
  if (Constants.isDevice !== true) return false;
  if (Platform.OS === 'android' && looksLikeAndroidEmulator()) return false;
  return true;
}

function looksLikeAndroidEmulator() {
  const blob = [
    Constants.deviceName,
    Constants.modelName,
    Constants.platformId,
    Constants.systemName,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return /sdk_gphone|emulator|generic|goldfish|ranchu|vbox|genymotion|android sdk built/.test(blob);
}

function resolveApiBaseUrl() {
  const physical = isPhysicalDevice();
  const lan =
    fromExpoExtraLan() ||
    fromLanHostEnv() ||
    (fromExpoPublicEnv() && isLanStyleUrl(fromExpoPublicEnv()) ? fromExpoPublicEnv() : null);

  // Android emulator must not use PC LAN IP (often unreachable from AVD)
  if (Platform.OS === 'android' && !physical) {
    return fromExpoExtraAndroidEmulator();
  }

  // Physical Android / iPhone on same Wi‑Fi as dev PC
  if (physical) {
    if (lan) return lan;
    const base = fromExpoPublicEnv();
    if (base && !isDeviceLocalhost(base) && !isAndroidEmulatorLoopback(base)) return base;
    return lan || ANDROID_EMULATOR_HOST;
  }

  // iOS Simulator
  if (Platform.OS === 'ios') {
    const base = fromExpoPublicEnv();
    if (base && !isAndroidEmulatorLoopback(base)) return base;
    return IOS_SIMULATOR_HOST;
  }

  return fromExpoExtraAndroidEmulator();
}

export function getApiBaseUrl() {
  return resolveApiBaseUrl();
}

export function getApiConfigHint() {
  const url = getApiBaseUrl();
  const physical = isPhysicalDevice();

  if (Platform.OS === 'android' && !physical) {
    return (
      'Android emulator uses http://10.0.2.2:5000. Start the backend on your PC. ' +
      'Optional: run scripts/open-android.ps1 to adb reverse port 5000.'
    );
  }

  if (physical && (isDeviceLocalhost(url) || !url)) {
    return (
      'On a real device, set EXPO_PUBLIC_API_LAN_HOST in mobile-app/.env to your PC Wi‑Fi IP (ipconfig), ' +
      'then restart: npx expo start -c'
    );
  }

  return null;
}
