import type { SVGProps } from "react";

// Shared OS navigation model — consumed by the Spaces menu + the space hubs.
export type NavItem = {
  href: string;
  label: string;
  Icon: (p: SVGProps<SVGSVGElement>) => React.ReactElement;
  blurb?: string;        // one-line description, shown on the space hub cards
};

// A SPACE is a task-oriented area of the OS. The menu shows the ~6 spaces (not a
// flat wall of 28 destinations); each space has a landing HUB page (`href`) whose
// cards link to its sub-surfaces (`items`). Organize by what you're DOING —
// Talk / Work / Knowledge / Create / System — not by internal subsystem.
export type Space = {
  key: string;
  label: string;
  href: string;
  blurb: string;
  Icon: (p: SVGProps<SVGSVGElement>) => React.ReactElement;
  items: NavItem[];
};

// Back-compat alias for the old grouped shape.
export type NavGroup = { label: string; items: NavItem[] };

export const NAV_HOME: NavItem = { href: "/", label: "Home", Icon: HomeIcon };

export const SPACES: Space[] = [
  {
    key: "talk",
    label: "Talk",
    href: "/talk",
    blurb: "Converse with Curly — type, run an agent, or talk out loud.",
    Icon: ChatIcon,
    items: [
      { href: "/chat", label: "Chat", Icon: ChatIcon, blurb: "Conversational chat with Curly." },
      { href: "/agent", label: "Agent", Icon: BoltIcon, blurb: "Command center for one-off agent tasks." },
      { href: "/surface", label: "Voice", Icon: OrbIcon, blurb: "Full-screen voice surface — tap the orb and talk." },
    ],
  },
  {
    key: "work",
    label: "Work",
    href: "/work",
    blurb: "Intent → plan → execute → verify. Your goals and the agents working them.",
    Icon: BoltIcon,
    items: [
      { href: "/goals", label: "Goals", Icon: GoalsIcon, blurb: "What you're trying to achieve, with progress." },
      { href: "/workspaces", label: "Workspaces", Icon: WorkspaceIcon, blurb: "Workspaces → projects → goals, and the files agents make." },
      { href: "/orchestrator", label: "Orchestrator", Icon: OrchestratorIcon, blurb: "Plans, worker agents, and the feedback loop." },
      { href: "/jobs", label: "Jobs", Icon: JobsIcon, blurb: "Scheduled, recurring autonomous work." },
      { href: "/inbox", label: "Inbox", Icon: InboxIcon, blurb: "Deliveries, plans to approve, goal results." },
      { href: "/runs", label: "Runs", Icon: RunsIcon, blurb: "Live and past agent run traces." },
      { href: "/approvals", label: "Approvals", Icon: ApprovalsIcon, blurb: "Actions waiting on your go-ahead." },
      { href: "/opportunities", label: "Opportunities", Icon: OpportunitiesIcon, blurb: "Proactive suggestions Curly surfaces." },
    ],
  },
  {
    key: "knowledge",
    label: "Knowledge",
    href: "/knowledge",
    blurb: "Everything the OS knows about you — memory, graph, notes, and your self-model.",
    Icon: BrainIcon,
    items: [
      { href: "/memory", label: "Memory", Icon: BrainIcon, blurb: "Facts and insights Curly remembers." },
      { href: "/episodes", label: "Episodes", Icon: LayersIcon, blurb: "The raw event log behind memory." },
      { href: "/graph", label: "Graph", Icon: GraphIcon, blurb: "Entities and how they relate." },
      { href: "/self", label: "Self", Icon: SelfIcon, blurb: "Who you are right now, synthesized." },
      { href: "/identity", label: "Identity", Icon: UserIcon, blurb: "The identity facts behind the self-model." },
      { href: "/notes", label: "Notes", Icon: NotesIcon, blurb: "Your notes vault." },
      { href: "/journal", label: "Journal", Icon: JournalIcon, blurb: "Daily journal entries." },
    ],
  },
  {
    key: "create",
    label: "Create",
    href: "/create",
    blurb: "Make and explore — sketches, what-ifs, decisions, and projects.",
    Icon: StudioIcon,
    items: [
      { href: "/studio", label: "Studio", Icon: StudioIcon, blurb: "Idea canvas and sketches." },
      { href: "/simulation", label: "Simulation", Icon: SimulationIcon, blurb: "Explore possible outcomes before acting." },
      { href: "/decisions", label: "Decisions", Icon: DecisionsIcon, blurb: "The decision registry and reviews." },
      { href: "/projects", label: "Projects", Icon: FolderIcon, blurb: "Your registered code projects." },
    ],
  },
  {
    key: "system",
    label: "System",
    href: "/system",
    blurb: "The meta layer — how Curly thinks, evolves, and stays healthy.",
    Icon: PulseIcon,
    items: [
      { href: "/cognition", label: "Cognition", Icon: CogIcon, blurb: "The cognitive machinery and pipelines." },
      { href: "/evolution", label: "Evolution", Icon: EvolutionIcon, blurb: "Prompt versions and self-modification." },
      { href: "/systems", label: "Systems", Icon: PulseIcon, blurb: "Service health and status." },
      { href: "/logs", label: "Logs", Icon: TerminalIcon, blurb: "System and event logs." },
      { href: "/care", label: "Care", Icon: HeartIcon, blurb: "A quiet check on how you're doing." },
    ],
  },
];

// Back-compat: the old grouped shape, derived from SPACES.
export const NAV_GROUPS: NavGroup[] = SPACES.map((s) => ({ label: s.label, items: s.items }));

// Flat list (Home + every space item) — for the command palette and any consumer
// that wants the ungrouped set.
export const NAV: NavItem[] = [NAV_HOME, ...SPACES.flatMap((s) => s.items)];

export function spaceForPath(pathname: string): Space | undefined {
  return SPACES.find(
    (s) => pathname === s.href || pathname.startsWith(s.href + "/") ||
      s.items.some((i) => pathname === i.href || pathname.startsWith(i.href + "/")),
  );
}

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
// Opportunities — radar / spark signal.
export function OpportunitiesIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      <circle cx="12" cy="12" r="3" />
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
// Orchestrator — a central hub conducting worker nodes.
export function OrchestratorIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <circle cx="12" cy="12" r="2.5" />
      <circle cx="5" cy="5" r="1.8" />
      <circle cx="19" cy="5" r="1.8" />
      <circle cx="5" cy="19" r="1.8" />
      <circle cx="19" cy="19" r="1.8" />
      <path d="M10.3 10.3 6.2 6.2M13.7 10.3l4.1-4.1M10.3 13.7l-4.1 4.1M13.7 13.7l4.1 4.1" />
    </svg>
  );
}
// Jobs — a clock face (scheduled, recurring work).
export function JobsIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
// Inbox — a tray with an incoming item.
export function InboxIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <path d="M4 13l2 5h12l2-5" />
      <path d="M4 13V5h16v8" />
      <path d="M9 13a3 3 0 0 0 6 0" />
    </svg>
  );
}
// Evolution — a DNA double-helix / spiral suggesting self-modification.
export function EvolutionIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <path d="M7 3c0 6 10 6 10 12S7 21 7 21" />
      <path d="M17 3c0 6-10 6-10 12s10 6 10 6" />
      <path d="M7 9h10M7 15h10" />
    </svg>
  );
}
