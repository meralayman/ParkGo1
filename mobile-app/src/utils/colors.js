export const Colors = {
  // Mirrors `src/index.css` tokens from ParkGo web
  bg: '#0f172a', // --bg-dark
  card: '#1e293b', // --bg-card
  elevated: '#334155', // --bg-elevated
  text: '#f1f5f9', // --text-primary
  textSecondary: '#cbd5e1',
  muted: '#94a3b8', // --text-muted
  border: 'rgba(148, 163, 184, 0.15)', // --border-subtle
  borderMedium: 'rgba(148, 163, 184, 0.25)',

  // Brand / accents
  logoBlue: '#2563eb',
  logoBlueLight: '#60a5fa',
  logoBlueDark: '#1e40af',
  accentPurple: '#6366f1',
  accentTeal: '#14b8a6',

  // Status
  success: '#10b981',
  successLight: '#6ee7b7',
  warning: '#f59e0b',
  warningLight: '#fbbf24',
  danger: '#ef4444',
  dangerLight: '#fca5a5',
  info: '#60a5fa',

  // Spacing
  space: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 28,
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    full: 9999,
  },
};

export function statusColor(level) {
  const v = String(level || '').toLowerCase();
  if (v === 'low') return Colors.success;
  if (v === 'medium') return Colors.warning;
  if (v === 'high') return Colors.danger;
  return Colors.info;
}

