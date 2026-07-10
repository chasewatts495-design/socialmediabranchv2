import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;

function base(props: P) {
  return {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...props,
  };
}

export const IconHome = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V21h14V9.5" />
    <path d="M10 21v-6h4v6" />
  </svg>
);

export const IconCalendar = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M8 3v4M16 3v4M3 10h18" />
  </svg>
);

export const IconCompose = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconLibrary = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="9" cy="9" r="2" />
    <path d="m21 15-4.5-4.5L7 20" />
  </svg>
);

export const IconSparkles = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3Z" />
    <path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2Z" />
  </svg>
);

export const IconPlug = (p: P) => (
  <svg {...base(p)}>
    <path d="M9 7V3M15 7V3" />
    <path d="M6 7h12v4a6 6 0 0 1-6 6 6 6 0 0 1-6-6V7Z" />
    <path d="M12 17v4" />
  </svg>
);

export const IconSettings = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.09a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.09a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1Z" />
  </svg>
);

export const IconChart = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 3v18h18" />
    <path d="M7 15l4-4 3 3 6-7" />
  </svg>
);

export const IconRetry = (p: P) => (
  <svg {...base(p)}>
    <path d="M21 12a9 9 0 1 1-2.64-6.36" />
    <path d="M21 3v6h-6" />
  </svg>
);

export const IconCheck = (p: P) => (
  <svg {...base(p)}>
    <path d="m4 12.5 5 5L20 6.5" />
  </svg>
);

export const IconX = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const IconUpload = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 16V4M6 10l6-6 6 6" />
    <path d="M4 20h16" />
  </svg>
);

export const IconTrash = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
  </svg>
);

export const IconExternal = (p: P) => (
  <svg {...base(p)}>
    <path d="M14 4h6v6M20 4l-9 9" />
    <path d="M20 14v6H4V4h6" />
  </svg>
);

export const IconClock = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 3" />
  </svg>
);

export const IconSend = (p: P) => (
  <svg {...base(p)}>
    <path d="M22 2 11 13" />
    <path d="M22 2 15 22l-4-9-9-4 20-7Z" />
  </svg>
);

export const IconWarning = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3 2 20h20L12 3Z" />
    <path d="M12 10v4M12 17.5v.5" />
  </svg>
);
