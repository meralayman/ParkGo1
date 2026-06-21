import React from 'react';

const WelcomeHeroIllustration = () => (
  <svg
    className="welcome-hero-art"
    viewBox="0 0 440 360"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden
  >
    <defs>
      <linearGradient id="wh-sky" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#0f172a" />
        <stop offset="100%" stopColor="#1e293b" />
      </linearGradient>
      <linearGradient id="wh-phone" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#1e293b" />
        <stop offset="100%" stopColor="#0f172a" />
      </linearGradient>
      <linearGradient id="wh-pin" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#3b82f6" />
        <stop offset="100%" stopColor="#8b5cf6" />
      </linearGradient>
      <linearGradient id="wh-glow" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.15" />
        <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.08" />
      </linearGradient>
      <filter id="wh-shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#3b82f6" floodOpacity="0.2" />
      </filter>
      <filter id="wh-glow-filter">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    <rect width="440" height="360" fill="url(#wh-sky)" rx="24" />
    <rect width="440" height="360" fill="url(#wh-glow)" rx="24" />
    <ellipse cx="220" cy="300" rx="180" ry="28" fill="#1e293b" opacity="0.6" />
    {/* Ground plane */}
    <path
      d="M60 240 L220 180 L380 240 L220 300 Z"
      fill="#1e293b"
      stroke="rgba(59,130,246,0.2)"
      strokeWidth="1"
    />
    {/* Grid lines on ground */}
    <line x1="140" y1="210" x2="220" y2="240" stroke="rgba(59,130,246,0.1)" strokeWidth="0.5" />
    <line x1="300" y1="210" x2="220" y2="240" stroke="rgba(59,130,246,0.1)" strokeWidth="0.5" />
    <line x1="140" y1="240" x2="300" y2="240" stroke="rgba(59,130,246,0.1)" strokeWidth="0.5" />
    {/* Phone body */}
    <g filter="url(#wh-shadow)" transform="translate(130, 72)">
      <rect x="0" y="0" width="180" height="220" rx="18" fill="url(#wh-phone)" stroke="rgba(59,130,246,0.25)" strokeWidth="1.5" />
      <rect x="12" y="24" width="156" height="168" rx="8" fill="rgba(59,130,246,0.05)" />
      {/* Screen */}
      <rect x="20" y="32" width="140" height="152" rx="6" fill="#080c14" />
      <g transform="translate(28, 44)">
        {[0, 1, 2].map((row) =>
          [0, 1, 2, 3].map((col) => {
            const isOccupied = (row + col) % 3 === 0;
            return (
              <rect
                key={`${row}-${col}`}
                x={col * 30 + (row % 2) * 8}
                y={row * 38}
                width="22"
                height="32"
                rx="4"
                fill={isOccupied ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.35)'}
                stroke={isOccupied ? 'rgba(239,68,68,0.5)' : 'rgba(16,185,129,0.6)'}
                strokeWidth="0.5"
              />
            );
          })
        )}
        <rect x="4" y="118" width="120" height="6" rx="3" fill="rgba(59,130,246,0.3)" />
      </g>
      {/* Notch */}
      <rect x="65" y="6" width="50" height="10" rx="5" fill="#080c14" />
    </g>
    {/* Map pin with glow */}
    <g transform="translate(198, 48)" filter="url(#wh-glow-filter)">
      <path
        d="M22 0C10 0 0 9 0 20c0 16 22 36 22 36s22-20 22-36C44 9 34 0 22 0z"
        fill="url(#wh-pin)"
      />
      <circle cx="22" cy="20" r="10" fill="rgba(255,255,255,0.9)" />
      <text x="22" y="25" textAnchor="middle" fontSize="14" fontWeight="700" fill="#3b82f6" fontFamily="system-ui,sans-serif">
        P
      </text>
    </g>
    {/* Buildings with neon edges */}
    <rect x="48" y="168" width="36" height="52" rx="4" fill="#1e293b" stroke="rgba(59,130,246,0.2)" strokeWidth="0.5" />
    <rect x="56" y="152" width="20" height="20" rx="2" fill="rgba(59,130,246,0.15)" stroke="rgba(59,130,246,0.3)" strokeWidth="0.5" />
    <rect x="356" y="176" width="40" height="44" rx="4" fill="#1e293b" stroke="rgba(139,92,246,0.2)" strokeWidth="0.5" />
    <rect x="364" y="160" width="24" height="18" rx="2" fill="rgba(139,92,246,0.15)" stroke="rgba(139,92,246,0.3)" strokeWidth="0.5" />
    {/* Cars with glow */}
    <rect x="72" y="248" width="28" height="14" rx="4" fill="rgba(59,130,246,0.3)" stroke="rgba(59,130,246,0.5)" strokeWidth="0.5" />
    <rect x="320" y="252" width="26" height="12" rx="4" fill="rgba(139,92,246,0.4)" stroke="rgba(139,92,246,0.6)" strokeWidth="0.5" />
    <rect x="260" y="268" width="24" height="11" rx="4" fill="rgba(16,185,129,0.4)" stroke="rgba(16,185,129,0.6)" strokeWidth="0.5" />
    {/* Glowing dots */}
    <circle cx="40" cy="220" r="3" fill="#3b82f6" opacity="0.6">
      <animate attributeName="opacity" values="0.3;0.8;0.3" dur="3s" repeatCount="indefinite" />
    </circle>
    <circle cx="400" cy="228" r="2.5" fill="#8b5cf6" opacity="0.5">
      <animate attributeName="opacity" values="0.3;0.7;0.3" dur="4s" repeatCount="indefinite" />
    </circle>
    <circle cx="120" cy="280" r="2" fill="#06b6d4" opacity="0.4">
      <animate attributeName="opacity" values="0.2;0.6;0.2" dur="3.5s" repeatCount="indefinite" />
    </circle>
    <circle cx="340" cy="290" r="2.5" fill="#3b82f6" opacity="0.45">
      <animate attributeName="opacity" values="0.3;0.7;0.3" dur="2.8s" repeatCount="indefinite" />
    </circle>
  </svg>
);

export default WelcomeHeroIllustration;
