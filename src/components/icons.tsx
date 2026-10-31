type P = { size?: number };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export const IconShield = ({ size = 16 }: P) => (
  <svg {...base(size)}>
    <path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);
export const IconInbox = ({ size = 22 }: P) => (
  <svg {...base(size)}>
    <path d="M4 13l2.5-7h11L20 13v5a1 1 0 01-1 1H5a1 1 0 01-1-1v-5z" />
    <path d="M4 13h4l1.5 2.5h5L16 13h4" />
  </svg>
);
export const IconPaste = ({ size = 22 }: P) => (
  <svg {...base(size)}>
    <rect x="6" y="4" width="12" height="17" rx="2" />
    <path d="M9 4.5V3h6v1.5M9 10h6M9 14h6M9 18h3" />
  </svg>
);
export const IconLink = ({ size = 22 }: P) => (
  <svg {...base(size)}>
    <path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" />
  </svg>
);
export const IconList = ({ size = 18 }: P) => (
  <svg {...base(size)}>
    <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
  </svg>
);
export const IconAlert = ({ size = 18 }: P) => (
  <svg {...base(size)}>
    <path d="M12 3l9.5 17h-19L12 3z" />
    <path d="M12 10v4M12 17.5h.01" />
  </svg>
);
export const IconQuestion = ({ size = 18 }: P) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 015 .5c0 1.7-2.5 2-2.5 3.5M12 17h.01" />
  </svg>
);
export const IconChat = ({ size = 18 }: P) => (
  <svg {...base(size)}>
    <path d="M4 5h16v11H9l-5 4V5z" />
  </svg>
);
export const IconWon = ({ size = 18 }: P) => (
  <svg {...base(size)}>
    <path d="M4 7l3 10 3-8 2 0 3 8 3-10M3 11h18M3 14h18" />
  </svg>
);
export const IconCheck = ({ size = 14 }: P) => (
  <svg {...base(size)} stroke="#4a1830" strokeWidth={3}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);
export const IconBack = ({ size = 22 }: P) => (
  <svg {...base(size)}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
);
export const IconEmpty = ({ size = 56 }: P) => (
  <svg width={size} height={size} viewBox="0 0 56 56" fill="none">
    <rect x="8" y="14" width="40" height="30" rx="8" fill="#FFF0F5" />
    <path d="M8 30h12l3 5h10l3-5h12" stroke="#B02A62" strokeWidth="2.4" strokeLinejoin="round" />
    <circle cx="40" cy="14" r="6" fill="#B02A62" />
  </svg>
);
