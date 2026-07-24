export function HeroBackdrop() {
  return (
    <svg
      viewBox="0 0 900 720"
      className="pointer-events-none absolute inset-0 h-full w-full"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="barFade" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#4f6bff" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#7c93ff" stopOpacity="0.35" />
        </linearGradient>
        <filter id="barGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="18" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g filter="url(#barGlow)">
        <rect x="560" y="420" width="90" height="260" rx="24" fill="url(#barFade)" />
        <rect x="690" y="300" width="90" height="380" rx="24" fill="url(#barFade)" />
        <rect x="820" y="160" width="90" height="520" rx="24" fill="url(#barFade)" />
      </g>
    </svg>
  );
}
