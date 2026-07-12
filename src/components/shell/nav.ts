export const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: "home" },
  { href: "/calendar", label: "Calendar", icon: "calendar" },
  { href: "/composer", label: "Compose", icon: "compose" },
  { href: "/trends", label: "Trend Radar", icon: "radar" },
  { href: "/library", label: "Library", icon: "library" },
  { href: "/strategist", label: "AI Strategist", icon: "sparkles" },
  { href: "/connections", label: "Connections", icon: "plug" },
  { href: "/settings", label: "Settings", icon: "settings" },
] as const;

/** The five slots on the mobile bottom tab bar (Compose sits center). */
export const MOBILE_TABS = ["/", "/calendar", "/composer", "/library", "/strategist"];
