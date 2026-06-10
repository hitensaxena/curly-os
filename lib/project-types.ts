// Client-safe project taxonomy. Lives apart from lib/projects.ts (which imports
// node:fs and must never reach the client bundle) so the create picker and the
// metadata editor can import the type table directly.

export type ProjectType = "web" | "writing" | "art" | "music" | "research" | "generic";

// Workspace section ids. Universal ones (docs/tasks/journal/mind) render for all
// types in P2; the type-specific ones are filled in by P4.
export type ModuleId =
  | "docs"
  | "tasks"
  | "journal"
  | "mind"
  | "gallery"
  | "chapters"
  | "tracks"
  | "decisions"
  | "goals"
  | "references";

export interface ProjectTypeMeta {
  label: string;
  emoji: string;
  scaffoldFiles: string[]; // markdown files seeded into a new project folder
  modules: ModuleId[]; // workspace sections, in render order
  wantsCodeDir: boolean; // show the `code:` input in the create flow
}

// Single source of truth for project kinds — drives the create picker, the
// scaffold file set, and which workspace sections render (P2/P4).
export const PROJECT_TYPES: Record<ProjectType, ProjectTypeMeta> = {
  web: {
    label: "Web / Code",
    emoji: "🛠️",
    scaffoldFiles: ["README.md", "about.md", "architecture.md", "tasks.md", "journal.md", "decisions.md"],
    modules: ["docs", "tasks", "decisions", "journal", "mind"],
    wantsCodeDir: true,
  },
  writing: {
    label: "Writing / Memoir",
    emoji: "✍️",
    scaffoldFiles: ["README.md", "outline.md", "chapters.md", "notes.md", "journal.md"],
    modules: ["docs", "chapters", "tasks", "journal", "mind"],
    wantsCodeDir: false,
  },
  art: {
    label: "Artwork",
    emoji: "🎨",
    scaffoldFiles: ["README.md", "gallery.md", "references.md", "journal.md"],
    modules: ["docs", "gallery", "references", "journal", "mind"],
    wantsCodeDir: false,
  },
  music: {
    label: "Music",
    emoji: "🎵",
    scaffoldFiles: ["README.md", "tracks.md", "raga-refs.md", "journal.md"],
    modules: ["docs", "tracks", "journal", "mind"],
    wantsCodeDir: false,
  },
  research: {
    label: "Research / Business",
    emoji: "🧭",
    scaffoldFiles: ["README.md", "goals.md", "decisions.md", "findings.md", "tasks.md"],
    modules: ["docs", "goals", "decisions", "tasks", "journal", "mind"],
    wantsCodeDir: true,
  },
  generic: {
    label: "Generic",
    emoji: "📁",
    scaffoldFiles: ["README.md", "notes.md", "tasks.md", "journal.md"],
    modules: ["docs", "tasks", "journal", "mind"],
    wantsCodeDir: false,
  },
};

export const PROJECT_TYPE_ORDER: ProjectType[] = ["web", "writing", "art", "music", "research", "generic"];

// Known display labels for statuses (status itself stays an open string — the
// live registry already uses values like `merged`).
export const KNOWN_STATUSES = ["active", "paused", "done", "merged"];

export function isProjectType(s: string): s is ProjectType {
  return (
    s === "web" || s === "writing" || s === "art" || s === "music" || s === "research" || s === "generic"
  );
}
