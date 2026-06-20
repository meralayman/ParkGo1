/** Loads mobile-app/.env and exposes API URLs via expo.extra (reliable in Expo Go). */
const fs = require('fs');
const path = require('path');
const appJson = require('./app.json');

function loadDotEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadDotEnv();

const DEFAULT_PORT = process.env.EXPO_PUBLIC_API_PORT || '5000';
const ANDROID_EMULATOR_DEFAULT = `http://10.0.2.2:${DEFAULT_PORT}`;

function trimUrl(v) {
  return typeof v === 'string' && v.trim() ? v.trim().replace(/\/$/, '') : '';
}

function lanHostToUrl(host) {
  let h = String(host).trim().replace(/\/$/, '');
  if (/^https?:\/\//i.test(h)) return h.replace(/\/$/, '');
  if (!h.includes(':')) h = `${h}:${DEFAULT_PORT}`;
  return `http://${h}`;
}

function resolveLanUrl() {
  const lanHost = (process.env.EXPO_PUBLIC_API_LAN_HOST || '').trim();
  const base = trimUrl(process.env.EXPO_PUBLIC_API_BASE_URL);

  if (lanHost) {
    const lanUrl = lanHostToUrl(lanHost);
    if (!base || /10\.0\.2\.2|127\.0\.0\.1|localhost/i.test(base)) {
      return lanUrl;
    }
  }

  if (base && !/10\.0\.2\.2|127\.0\.0\.1|localhost/i.test(base)) {
    return base;
  }

  return lanHost ? lanHostToUrl(lanHost) : '';
}

module.exports = () => {
  const apiBaseUrlLan = resolveLanUrl();
  const apiBaseUrlAndroidEmulator =
    trimUrl(process.env.EXPO_PUBLIC_API_ANDROID_EMULATOR_URL) || ANDROID_EMULATOR_DEFAULT;

  return {
    ...appJson.expo,
    android: {
      ...appJson.expo.android,
      usesCleartextTraffic: true,
    },
    extra: {
      ...(appJson.expo.extra || {}),
      apiBaseUrlLan: apiBaseUrlLan || undefined,
      apiBaseUrlAndroidEmulator,
      // Legacy single field — do not use on Android emulator (see config.js)
      apiBaseUrl: apiBaseUrlLan || undefined,
    },
  };
};
