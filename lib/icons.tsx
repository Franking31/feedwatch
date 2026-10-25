type P = { size?: number };

function Svg({
  size = 22,
  fill = "none",
  children,
}: P & { fill?: string; children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={fill}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const ArticlesIcon = (p: P) => (
  <Svg {...p}>
    <rect x="4" y="4" width="16" height="16" rx="2" />
    <path d="M8 9h8M8 13h8M8 17h5" />
  </Svg>
);

export const DigestIcon = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 7l9 6 9-6" />
  </Svg>
);

export const FeedIcon = (p: P) => (
  <Svg {...p}>
    <path d="M5 5a14 14 0 0 1 14 14M5 11a8 8 0 0 1 8 8" />
    <circle cx="6" cy="18" r="1.5" />
  </Svg>
);

export const SunIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" />
  </Svg>
);

export const MoonIcon = (p: P) => (
  <Svg {...p}>
    <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" />
  </Svg>
);

export const MonitorIcon = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="12" rx="2" />
    <path d="M8 20h8M12 16v4" />
  </Svg>
);

export const LogoutIcon = (p: P) => (
  <Svg {...p}>
    <path d="M9 4H5v16h4M16 8l4 4-4 4M20 12H9" />
  </Svg>
);

export const SearchIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6" />
    <path d="M20 20l-4.5-4.5" />
  </Svg>
);

export const RefreshIcon = (p: P) => (
  <Svg {...p}>
    <path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5" />
  </Svg>
);

export const ChevronIcon = (p: P) => (
  <Svg {...p}>
    <path d="M9 6l6 6-6 6" />
  </Svg>
);

export const BookmarkIcon = ({
  filled = false,
  size = 18,
}: P & { filled?: boolean }) => (
  <Svg size={size} fill={filled ? "currentColor" : "none"}>
    <path d="M7 4h10v16l-5-4-5 4z" />
  </Svg>
);

// Cercle vide : non lu. Cercle avec coche : lu.
export const ReadIcon = ({
  filled = false,
  size = 18,
}: P & { filled?: boolean }) => (
  <Svg size={size}>
    <circle cx="12" cy="12" r="8" />
    {filled && <path d="M8.5 12.5l2.5 2.5 4.5-5" />}
  </Svg>
);

// Le logo : trois lignes de texte, la première surlignée
export function LogoMark({ size = 36 }: P) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      <rect x="10" y="16" width="44" height="10" rx="5" fill="#FFE27A" />
      <rect x="10" y="31" width="44" height="7" rx="3.5" fill="#FFFFFF" />
      <rect x="10" y="43" width="26" height="7" rx="3.5" fill="#FFFFFF" fillOpacity="0.7" />
    </svg>
  );
}