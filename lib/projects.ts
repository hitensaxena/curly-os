// Project registry (server-only). Projects aren't folders in the vault yet —
// they live in START_HERE/current_goals — so the source of truth is an editable
// markdown note `ai-context/projects.md` (one `##` block per project). If that
// note doesn't exist, we derive a default list from the user's known goals +
// any real `projects/active/*` folders, with no implicit write. createProject
// scaffolds a real folder from the per-type template and writes/extends the
// registry.
//
// Round-trip safety: parseRegistry preserves any bullet it doesn't model into
// `extraLines`, and serializeRegistry re-emits them — so hand-edited keys (and
// the live `code:` key) are never silently dropped on the next write.
import { promises as fs } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { CODE_ROOT, HOME, VAULT } from "@/lib/paths";
import { resolveInVault, saveVaultNote } from "@/lib/vault-fs";
import { triggerReindex } from "@/lib/reindex";
import {
  KNOWN_STATUSES,
  PROJECT_TYPES,
  isProjectType,
  type ModuleId,
  type ProjectType,
  type ProjectTypeMeta,
} from "@/lib/project-types";

// Re-export the client-safe taxonomy so server code can import everything from
// "@/lib/projects" as before.
export { KNOWN_STATUSES, PROJECT_TYPES };
export type { ModuleId, ProjectType, ProjectTypeMeta };

const pexec = promisify(execFile);

export interface ProjectLink {
  label: string;
  url: string;
}

export interface Project {
  slug: string;
  name: string;
  status: string; // open string: active | paused | done | merged | ...
  dir: string | null; // vault-relative folder if scaffolded
  summary: string;
  type: ProjectType;
  codeDir: string | null; // external code repo (registry key `code:`), inside CODE_ROOT
  emoji: string | null;
  color: string | null; // a design-token name, NEVER a raw --accent value
  links: ProjectLink[];
  archived: boolean;
  extraLines: string[]; // unmodeled `- key: val` bullets, preserved verbatim
}

export const REGISTRY_REL = "ai-context/projects.md";
const TEMPLATE_DIR = "projects/_template";
const ACTIVE_DIR = "projects/active";

// Fill the new structured fields with defaults around a minimal core, so the
// hardcoded defaults and folder-scanned entries stay valid `Project`s.
function baseProject(
  core: Pick<Project, "slug" | "name" | "status" | "dir" | "summary"> & Partial<Project>,
): Project {
  return {
    type: core.codeDir ? "web" : "generic",
    codeDir: null,
    emoji: null,
    color: null,
    links: [],
    archived: false,
    extraLines: [],
    ...core,
  };
}

// Seeded from START_HERE.md / ai-context/current_goals.md (the real active
// work). Dead in practice once the registry note exists (registry wins), but
// kept as the no-registry fallback.
const DEFAULT_PROJECTS: Project[] = [
  baseProject({ slug: "mintrix", name: "Mintrix", status: "active", dir: null, type: "research",
    summary: "AI-OS for schools — the primary professional anchor. Sprint 1: brand identity, product wireframes, onboarding UX, pitch deck." }),
  baseProject({ slug: "crazymage-web", name: "crazymage-web", status: "active", dir: "projects/active/crazymage-web", type: "web",
    summary: "Personal spiritual/philosophical blog + digital art + music (Next.js + Supabase, WebGL aesthetic)." }),
  baseProject({ slug: "music", name: "Techno music", status: "active", dir: null, type: "music",
    summary: "Ableton 12 + Akai MPK Mini; Indian classical raga integration (Bhairav, Yaman). The main decompression valve." }),
  baseProject({ slug: "ai-os", name: "Personal AI OS", status: "active", dir: null, type: "web",
    summary: "Self-hosted Curly OS infra — Claude Code + PM2 + Tailscale on the VPS. (This.)" }),
  baseProject({ slug: "portfolio", name: "UI/UX portfolio", status: "active", dir: null, type: "web",
    summary: "Immersive/3D portfolio with case studies (AI research assistant, Airbnb-style)." }),
];

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 60) || "project"
  );
}

function prettyName(slug: string): string {
  return slug.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Expand a leading `~` to the home dir (registry stores readable `~/code/...`).
export function expandHome(p: string): string {
  if (p === "~") return HOME;
  if (p.startsWith("~/")) return path.join(HOME, p.slice(2));
  return p;
}

async function exists(rel: string): Promise<boolean> {
  try {
    await fs.access(resolveInVault(rel));
    return true;
  } catch {
    return false;
  }
}

// Bullet keys we model explicitly; everything else is preserved as an extraLine.
const MODELED_KEYS = new Set([
  "slug", "status", "dir", "summary", "type", "code", "codedir", "emoji", "color", "links", "archived",
]);

function parseLinks(raw: string): ProjectLink[] {
  if (!raw.trim()) return [];
  return raw
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const eq = part.indexOf("=");
      if (eq > 0) return { label: part.slice(0, eq).trim(), url: part.slice(eq + 1).trim() };
      let label = part;
      try {
        label = new URL(part).host.replace(/^www\./, "");
      } catch {
        /* not a url — keep as-is */
      }
      return { label, url: part };
    })
    .filter((l) => l.url);
}

function serializeLinks(links: ProjectLink[]): string {
  return links.map((l) => (l.label && l.label !== l.url ? `${l.label}=${l.url}` : l.url)).join(" | ");
}

function parseRegistry(raw: string): Project[] {
  const blocks = raw.split(/^##\s+/m).slice(1);
  const out: Project[] = [];
  for (const b of blocks) {
    const lines = b.split("\n");
    const name = lines[0].trim();
    if (!name) continue;
    const get = (k: string) => {
      const l = lines.find((x) => new RegExp(`^\\s*-\\s*${k}\\s*:`, "i").test(x));
      return l ? l.slice(l.indexOf(":") + 1).trim() : "";
    };
    // Collect any modeled-but-unknown bullets verbatim so a write never drops them.
    const extraLines: string[] = [];
    for (const x of lines.slice(1)) {
      const m = x.match(/^\s*-\s*([\w-]+)\s*:/);
      if (m && !MODELED_KEYS.has(m[1].toLowerCase())) extraLines.push(x.trimEnd());
    }
    const slug = get("slug") || slugify(name);
    const dir = get("dir");
    const codeRaw = get("codeDir") || get("code");
    const typeRaw = get("type").toLowerCase();
    const type: ProjectType = isProjectType(typeRaw) ? typeRaw : codeRaw ? "web" : "generic";
    out.push({
      slug,
      name,
      status: get("status") || "active",
      dir: dir ? dir.replace(/\/+$/, "") : null,
      summary: get("summary"),
      type,
      codeDir: codeRaw || null,
      emoji: get("emoji") || null,
      color: get("color") || null,
      links: parseLinks(get("links")),
      archived: get("archived").toLowerCase() === "true",
      extraLines,
    });
  }
  return out;
}

function serializeRegistry(projects: Project[]): string {
  const head =
    "---\nsource: curly-os\n---\n\n# Projects\n\nThe registry behind the OS Projects workspace. Edit freely — one `##` block per project.\n";
  const blocks = projects
    .map((p) => {
      const out = [`## ${p.name}`, `- slug: ${p.slug}`, `- type: ${p.type}`, `- status: ${p.status}`, `- dir: ${p.dir ?? ""}`];
      if (p.codeDir) out.push(`- code: ${p.codeDir}`);
      if (p.emoji) out.push(`- emoji: ${p.emoji}`);
      if (p.color) out.push(`- color: ${p.color}`);
      if (p.links.length) out.push(`- links: ${serializeLinks(p.links)}`);
      if (p.archived) out.push(`- archived: true`);
      out.push(`- summary: ${p.summary}`);
      for (const extra of p.extraLines) out.push(extra.startsWith("-") ? extra : `- ${extra}`);
      return out.join("\n");
    })
    .join("\n\n");
  return `${head}\n${blocks}\n`;
}

// Real folders under projects/active that aren't in the given list.
async function scanActive(known: Set<string>): Promise<Project[]> {
  const out: Project[] = [];
  try {
    const entries = await fs.readdir(resolveInVault(ACTIVE_DIR), { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory() || e.name.startsWith(".") || e.name.startsWith("_")) continue;
      const slug = e.name;
      if (known.has(slug)) continue;
      out.push(baseProject({ slug, name: prettyName(slug), status: "active", dir: `${ACTIVE_DIR}/${slug}`, summary: "" }));
    }
  } catch {
    /* no active dir */
  }
  return out;
}

export async function registryExists(): Promise<boolean> {
  return exists(REGISTRY_REL);
}

export async function listProjects(): Promise<Project[]> {
  if (await exists(REGISTRY_REL)) {
    try {
      const raw = await fs.readFile(resolveInVault(REGISTRY_REL), "utf8");
      const fromNote = parseRegistry(raw);
      const known = new Set(fromNote.map((p) => p.slug));
      return [...fromNote, ...(await scanActive(known))];
    } catch {
      /* fall through to defaults */
    }
  }
  const known = new Set(DEFAULT_PROJECTS.map((p) => p.slug));
  return [...DEFAULT_PROJECTS, ...(await scanActive(known))];
}

export async function getProject(slug: string): Promise<Project | null> {
  return (await listProjects()).find((p) => p.slug === slug) ?? null;
}

// Write the current derived list to the editable registry note (idempotent-ish).
export async function seedRegistry(): Promise<{ ok: boolean; rel: string }> {
  const projects = await listProjects();
  await saveVaultNote(REGISTRY_REL, serializeRegistry(projects));
  return { ok: true, rel: REGISTRY_REL };
}

// Validate a user-supplied `code:` dir: absolute (after ~ expansion), existing,
// a directory, and contained within CODE_ROOT. This containment is the seam the
// per-project chat's agentic writes rely on.
export async function validateCodeDir(input: string): Promise<{ ok: boolean; value?: string; reason?: string }> {
  const trimmed = input.trim();
  if (!trimmed) return { ok: true, value: "" };
  const abs = path.resolve(expandHome(trimmed));
  if (abs !== CODE_ROOT && !abs.startsWith(CODE_ROOT + path.sep)) {
    return { ok: false, reason: `code dir must be inside ${CODE_ROOT}` };
  }
  try {
    const st = await fs.stat(abs);
    if (!st.isDirectory()) return { ok: false, reason: "code path is not a directory" };
  } catch {
    return { ok: false, reason: "code dir does not exist" };
  }
  return { ok: true, value: trimmed };
}

// Minimal seed body for a scaffold file when the template folder lacks it.
function seedFor(file: string, name: string, summary: string): string {
  const f = file.toLowerCase();
  if (f === "readme.md") return `# ${name}\n\n${summary || "New project."}\n`;
  if (f === "tasks.md") return `# Tasks\n\n## Tasks\n`;
  if (f === "journal.md") return `# Journal\n\nDated capture log for this project.\n`;
  if (f === "decisions.md") return `# Decisions\n\nDated decisions and the reasoning behind them.\n`;
  if (f === "gallery.md") return `# Gallery\n\nOne image per line: \`![alt](relative/path.png) — caption\`\n`;
  if (f === "tracks.md") return `# Tracks\n\nOne per line: \`- title — bpm/key/raga — status\`\n`;
  if (f === "raga-refs.md") return `# Raga references\n`;
  if (f === "chapters.md") return `# Chapters\n\nOne \`## Chapter title\` per section.\n`;
  if (f === "outline.md") return `# Outline\n`;
  if (f === "notes.md") return `# Notes\n`;
  if (f === "about.md") return `# About ${name}\n`;
  if (f === "architecture.md") return `# Architecture\n`;
  if (f === "references.md") return `# References\n`;
  if (f === "goals.md") return `# Goals\n`;
  if (f === "findings.md") return `# Findings\n`;
  return `# ${prettyName(file.replace(/\.md$/i, ""))}\n`;
}

// Resolve a scaffold file's body: per-type template, then legacy flat template,
// then a generated stub. README always gets the project name as an H1.
async function scaffoldBody(type: ProjectType, file: string, name: string, summary: string): Promise<string> {
  const candidates = [`${TEMPLATE_DIR}/${type}/${file}`, `${TEMPLATE_DIR}/${file}`];
  for (const rel of candidates) {
    try {
      const body = await fs.readFile(resolveInVault(rel), "utf8");
      return file.toLowerCase() === "readme.md" ? `# ${name}\n\n${body}` : body;
    } catch {
      /* try next */
    }
  }
  return seedFor(file, name, summary);
}

export interface CreateProjectOpts {
  slug?: string;
  type?: ProjectType;
  code?: string;
  summary?: string;
  emoji?: string;
}

// Scaffold projects/active/<slug>/ from the per-type template and register it.
// Pass opts.slug to fill an existing folderless registry entry (keeps its slug).
export async function createProject(
  name: string,
  opts: CreateProjectOpts = {},
): Promise<{ ok: boolean; slug: string; dir: string; reason?: string }> {
  const slug = opts.slug || slugify(name);
  const type: ProjectType = opts.type && isProjectType(opts.type) ? opts.type : "generic";
  const summary = opts.summary?.trim() ?? "";
  const dir = `${ACTIVE_DIR}/${slug}`;
  if (await exists(dir)) {
    return { ok: false, slug, dir, reason: "already exists" };
  }

  // Validate code dir up front (don't scaffold if it was supplied but bad).
  let codeDir: string | null = null;
  if (opts.code && opts.code.trim()) {
    const v = await validateCodeDir(opts.code);
    if (!v.ok) return { ok: false, slug, dir, reason: v.reason };
    codeDir = v.value || null;
  }

  await fs.mkdir(resolveInVault(dir), { recursive: true });
  for (const file of PROJECT_TYPES[type].scaffoldFiles) {
    const body = await scaffoldBody(type, file, name, summary);
    await fs.writeFile(resolveInVault(`${dir}/${file}`), body, "utf8");
  }

  // One atomic commit for the whole new folder, then a single reindex.
  try {
    await pexec("git", ["-C", VAULT, "add", "--", dir], { timeout: 8000 });
    await pexec("git", ["-C", VAULT, "commit", "-m", `curly-os: new project ${slug}`, "--", dir], {
      timeout: 8000,
    });
  } catch {
    /* nothing to commit / git hiccup — non-fatal */
  }
  triggerReindex();

  // Register it (creates ai-context/projects.md if missing; commits + ingests).
  const projects = await listProjects();
  const next = projects.some((p) => p.slug === slug)
    ? projects.map((p) => (p.slug === slug ? { ...p, dir, type, codeDir, summary: summary || p.summary, emoji: opts.emoji ?? p.emoji } : p))
    : [...projects, baseProject({ slug, name, status: "active", dir, summary, type, codeDir, emoji: opts.emoji ?? null })];
  await saveVaultNote(REGISTRY_REL, serializeRegistry(next));

  return { ok: true, slug, dir };
}

export type ProjectPatch = Partial<
  Pick<Project, "name" | "summary" | "status" | "type" | "emoji" | "color" | "links" | "archived">
> & { code?: string };

// Edit a project's registry metadata. Loads the (merged) list, applies the
// patch to the matching block, and rewrites the registry note.
export async function updateProject(
  slug: string,
  patch: ProjectPatch,
): Promise<{ ok: boolean; project?: Project; reason?: string }> {
  const projects = await listProjects();
  const current = projects.find((p) => p.slug === slug);
  if (!current) return { ok: false, reason: "not found" };

  let codeDir = current.codeDir;
  if (patch.code !== undefined) {
    const v = await validateCodeDir(patch.code);
    if (!v.ok) return { ok: false, reason: v.reason };
    codeDir = v.value ? v.value : null;
  }

  const updated: Project = {
    ...current,
    name: patch.name ?? current.name,
    summary: patch.summary ?? current.summary,
    status: patch.status ?? current.status,
    type: patch.type && isProjectType(patch.type) ? patch.type : current.type,
    emoji: patch.emoji !== undefined ? patch.emoji : current.emoji,
    color: patch.color !== undefined ? patch.color : current.color,
    links: patch.links ?? current.links,
    archived: patch.archived ?? current.archived,
    codeDir,
  };

  const next = projects.map((p) => (p.slug === slug ? updated : p));
  await saveVaultNote(REGISTRY_REL, serializeRegistry(next));
  return { ok: true, project: updated };
}
