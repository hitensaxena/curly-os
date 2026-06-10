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
      { href: "/studio", label: "Studio", Icon: StudioIcon },
      { href: "/simulation", label: "Simulation", Icon: SimulationIcon },
      { href: "/goals", label: "Goals", Icon: GoalsIcon },
      { href: "/decisions", label: "Decisions", Icon: DecisionsIcon },
      { href: "/workspaces", label: "Workspaces", Icon: WorkspaceIcon },
      { href: "/projects", label: "Projects", Icon: FolderIcon },
    ],
  },
  {
    label: "Capture",
    items: [
      { href: "/journal", label: "Journal", Icon: JournalIcon },
      { href: "/notes", label: "Notes", Icon: NotesIcon },
      { href: "/care", label: "Care", Icon: HeartIcon },
    ],
  },
  {
    label: "Converse",
    items: [
      { href: "/chat", label: "Chat", Icon: ChatIcon },
      { href: "/agent", label: "Agent", Icon: BoltIcon },
      { href: "/surface", label: "Surface", Icon: OrbIcon },
      { href: "/runs", label: "Runs", Icon: RunsIcon },
      { href: "/approvals", label: "Approvals", Icon: ApprovalsIcon },
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
export function FolderIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <path d="M3 6h6l2 2h10v11H3z" />
    </svg>
  );
}
export function JournalIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <path d="M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2z" />
      <path d="M9 8h6M9 12h6" />
    </svg>
  );
}
export function HeartIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <path d="M12 20s-7-4.6-7-9.5A3.5 3.5 0 0 1 12 7a3.5 3.5 0 0 1 7 3.5C19 15.4 12 20 12 20z" />
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
export function NotesIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M14 3v5h5M9 12h7M9 16h7" />
    </svg>
  );
}
export function BoltIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
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
// Studio — idea canvas (lightbulb).
export function StudioIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <path d="M9 18h6" />
      <path d="M10 21h4" />
      <path d="M12 3a6 6 0 0 0-4 10.5c.6.6 1 1.4 1 2.5h6c0-1.1.4-1.9 1-2.5A6 6 0 0 0 12 3z" />
    </svg>
  );
}
// Simulation — one node branching into possible outcomes.
export function SimulationIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <circle cx="6" cy="6" r="2" />
      <circle cx="6" cy="18" r="2" />
      <circle cx="18" cy="12" r="2" />
      <path d="M8 7l8 4M8 17l8-4" />
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
// Workspaces — a 2×2 grid of project spaces.
export function WorkspaceIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}
// Runs — a play button inside a loop/cycle arc.
export function RunsIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <path d="M17.7 7.3A8 8 0 1 0 19 12" />
      <path d="M10 9l5 3-5 3V9z" />
    </svg>
  );
}
// Approvals — a shield with a check mark.
export function ApprovalsIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <path d="M12 3 4 6v6c0 4 3.6 7.7 8 9 4.4-1.3 8-5 8-9V6z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}
