"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SVGProps } from "react";
import { Logo } from "@/components/Logo";
import { useVoice } from "@/lib/voice/VoiceContext";
import { VOICE_LABEL } from "@/lib/voice/colors";

// Persistent left rail for the OS shell. Icon-only on narrow screens, icon +
// label from lg. Active state via usePathname; the ⌘K button reuses the
// CommandPalette's open event so there's one launcher.
type NavItem = {
  href: string;
  label: string;
  Icon: (p: SVGProps<SVGSVGElement>) => React.ReactElement;
};

const NAV: NavItem[] = [
  { href: "/", label: "Home", Icon: HomeIcon },
  { href: "/memory", label: "Memory", Icon: MemoryIcon },
  { href: "/graph", label: "Graph", Icon: GraphIcon },
  { href: "/search", label: "Search", Icon: SearchIcon },
  { href: "/chat", label: "Chat", Icon: ChatIcon },
  { href: "/surface", label: "Surface", Icon: OrbIcon },
];

export function AppDock() {
  const pathname = usePathname();
  const v = useVoice();
  const live = v.state !== "idle" && v.state !== "error";
  const toggleVoice = () => {
    const c = v.controls;
    if (!c) return;
    if (v.state === "idle" || v.state === "error") c.start();
    else c.stop();
  };

  return (
    <nav className="sticky top-0 z-20 flex h-screen w-16 shrink-0 flex-col gap-1 border-r border-border bg-surface/50 px-2 py-3 backdrop-blur-sm lg:w-52">
      <Link href="/" className="mb-3 flex items-center gap-2 px-1.5 py-1">
        <Logo size="sm" />
        <span className="hidden text-sm font-semibold text-foreground lg:inline">
          Curly OS
        </span>
      </Link>

      {NAV.map(({ href, label, Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            title={label}
            className={[
              "relative flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors",
              active
                ? "bg-accent-soft text-foreground glow border-l-2 border-accent"
                : "text-muted hover:bg-surface-2 hover:text-accent",
            ].join(" ")}
          >
            <Icon
              className={[
                "h-5 w-5 shrink-0 transition-colors",
                active ? "text-accent" : "",
              ].join(" ")}
            />
            <span className="hidden lg:inline">{label}</span>
          </Link>
        );
      })}

      <div className="mt-auto flex flex-col gap-1">
        {/* Live Curly status — click to start/stop voice */}
        <button
          type="button"
          onClick={toggleVoice}
          title={live ? `Curly: ${VOICE_LABEL[v.state]} — tap to stop` : "Talk to Curly"}
          className="flex items-center gap-3 rounded-md px-2.5 py-2 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-accent"
        >
          <span
            aria-hidden
            className={`h-2.5 w-2.5 shrink-0 rounded-full ${live ? "animate-pulse" : ""}`}
            style={{
              background: "rgb(var(--voice-rgb))",
              boxShadow: live
                ? `0 0 8px rgb(var(--voice-rgb)), 0 0 0 2px rgba(var(--voice-rgb), 0.20)`
                : undefined,
            }}
          />
          <span className="hidden min-w-0 flex-1 truncate lg:inline">
            {v.caption && live ? v.caption : VOICE_LABEL[v.state]}
          </span>
        </button>

        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("curly-palette-open"))}
          title="Command palette"
          className="flex items-center gap-3 rounded-md px-2.5 py-2 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-accent"
        >
          <CommandIcon className="h-5 w-5 shrink-0" />
          <span className="hidden lg:inline">⌘K</span>
        </button>
      </div>
    </nav>
  );
}

// --- icons (inline, stroke=currentColor; no icon-lib dependency) ---

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
};

function HomeIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  );
}
function MemoryIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <path d="M12 3a4 4 0 0 0-4 4c0 1.5.8 2.8 2 3.4V12h4v-1.6c1.2-.6 2-1.9 2-3.4a4 4 0 0 0-4-4z" />
      <path d="M12 12v4" />
      <path d="M8 16h8" />
      <path d="M9 20h6" />
    </svg>
  );
}
function GraphIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <circle cx="6" cy="6" r="2" />
      <circle cx="18" cy="6" r="2" />
      <circle cx="12" cy="18" r="2" />
      <path d="M6 8l4 8M18 8l-4 8" />
    </svg>
  );
}
function SearchIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </svg>
  );
}
function ChatIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <path d="M4 5h16v11H8l-4 4z" />
    </svg>
  );
}
function OrbIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function CommandIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <path d="M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3z" />
    </svg>
  );
}
