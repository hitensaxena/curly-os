import type { SVGProps } from "react";

// Shared OS navigation model — consumed by the Spaces menu in the Curly bar.
export type NavItem = {
  href: string;
  label: string;
  Icon: (p: SVGProps<SVGSVGElement>) => React.ReactElement;
};

export type NavGroup = { label: string; items: NavItem[] };

// Home stands alone at the top; everything else is grouped so the menu reads as
// sections (Mind / Make / Capture / Converse / System) rather than a flat wall.
export const NAV_HOME: NavItem = { href: "/", label: "Home", Icon: HomeIcon };

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Mind",
    items: [
      { href: "/self", label: "Self", Icon: SelfIcon },
      { href: "/memory", label: "Memory", Icon: BrainIcon },
      { href: "/identity", label: "Identity", Icon: UserIcon },
      { href: "/graph", label: "Graph", Icon: GraphIcon },
      { href: "/cognition", label: "Cognition", Icon: CogIcon },
    ],
  },
  {
    label: "Make",
    items: [
      { href: "/goals", label: "Goals", Icon: GoalsIcon },
      { href: "/opportunities", label: "Opportunities", Icon: OpportunitiesIcon },
      { href: "/decisions", label: "Decisions", Icon: DecisionsIcon },
    ],
  },
  {
    label: "Converse",
    items: [
      { href: "/chat", label: "Chat", Icon: ChatIcon },
      { href: "/surface", label: "Surface", Icon: OrbIcon },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/search", label: "Search", Icon: SearchIcon },
      { href: "/episodes", label: "Episodes", Icon: LayersIcon },
      { href: "/logs", label: "Logs", Icon: TerminalIcon },
      { href: "/systems", label: "Systems", Icon: PulseIcon },
    ],
  },
];

// Flat list (Home + every grouped item) — kept for any consumer that wants the
// ungrouped set.
export const NAV: NavItem[] = [NAV_HOME, ...NAV_GROUPS.flatMap((g) => g.items)];

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
};

export function HomeIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  );
}
export function SearchIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </svg>
  );
}
export function ChatIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <path d="M4 5h16v11H8l-4 4z" />
    </svg>
  );
}
export function OrbIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
export function ChevronIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
export function BrainIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <path d="M12 3a4 4 0 0 0-4 4c0 1.5.8 2.8 2 3.4V12h4v-1.6c1.2-.6 2-1.9 2-3.4a4 4 0 0 0-4-4z" />
      <path d="M12 12v4" />
      <path d="M8 16h8" />
      <path d="M9 20h6" />
    </svg>
  );
}
export function GraphIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <circle cx="6" cy="6" r="2" />
      <circle cx="18" cy="6" r="2" />
      <circle cx="12" cy="18" r="2" />
      <path d="M6 8l4 8M18 8l-4 8" />
    </svg>
  );
}
export function UserIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  );
}
export function CogIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
export function PulseIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <path d="M3 12h4l2-6 4 12 2-6h6" />
    </svg>
  );
}
export function TerminalIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 9l3 3-3 3" />
      <path d="M13 15h4" />
    </svg>
  );
}
export function LayersIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <path d="M12 2 2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  );
}
// Self — concentric awareness / the synthesized self-model.
export function SelfIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="7.5" />
      <path d="M12 1.5V3M12 21v1.5M1.5 12H3M21 12h1.5" />
    </svg>
  );
}
// Goals — a target / bullseye.
export function GoalsIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2" />
    </svg>
  );
}
// Decisions — a fork / branching path.
export function DecisionsIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <path d="M6 3v6l6 4 6-4V3" />
      <path d="M12 13v8" />
    </svg>
  );
}
// Opportunities — radar / spark signal.
export function OpportunitiesIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
