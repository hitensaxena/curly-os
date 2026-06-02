// Project registry (server-only). Projects aren't folders in the vault yet —
// they live in START_HERE/current_goals — so the source of truth is an editable
// markdown note `ai-context/projects.md` (one `##` block per project). If that
// note doesn't exist, we derive a default list from the user's known goals +
// any real `projects/active/*` folders, with no implicit write. createProject
// scaffolds a real folder from the template and writes/extends the registry.
import { promises as fs } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { VAULT } from "@/lib/paths";
import { resolveInVault, saveVaultNote } from "@/lib/vault-fs";
import { triggerReindex } from "@/lib/reindex";

const pexec = promisify(execFile);

export interface Project {
  slug: string;
  name: string;
  status: string; // active | paused | done
  dir: string | null; // vault-relative folder if scaffolded
  summary: string;
}

export const REGISTRY_REL = "ai-context/projects.md";
const TEMPLATE_DIR = "projects/_template";
const ACTIVE_DIR = "projects/active";

// Seeded from START_HERE.md / ai-context/current_goals.md (the real active work).
const DEFAULT_PROJECTS: Project[] = [
  {
    slug: "mintrix",
    name: "Mintrix",
    status: "active",
    dir: null,
    summary:
      "AI-OS for schools — the primary professional anchor. Sprint 1: brand identity, product wireframes, onboarding UX, pitch deck.",
  },
  {
    slug: "crazymage-web",
    name: "crazymage-web",
    status: "active",
    dir: "projects/active/crazymage-web",
    summary:
      "Personal spiritual/philosophical blog + digital art + music (Next.js + Supabase, WebGL aesthetic).",
  },
  {
    slug: "music",
    name: "Techno music",
    status: "active",
    dir: null,
    summary:
      "Ableton 12 + Akai MPK Mini; Indian classical raga integration (Bhairav, Yaman). The main decompression valve.",
  },
  {
    slug: "ai-os",
    name: "Personal AI OS",
    status: "active",
    dir: null,
    summary: "Self-hosted Curly OS infra — Claude Code + PM2 + Tailscale on the VPS. (This.)",
  },
  {
    slug: "portfolio",
    name: "UI/UX portfolio",
    status: "active",
    dir: null,
    summary: "Immersive/3D portfolio with case studies (AI research assistant, Airbnb-style).",
  },
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

async function exists(rel: string): Promise<boolean> {
  try {
    await fs.access(resolveInVault(rel));
    return true;
  } catch {
    return false;
  }
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
    const slug = get("slug") || slugify(name);
    const dir = get("dir");
    out.push({
      slug,
      name,
      status: get("status") || "active",
      dir: dir ? dir.replace(/\/+$/, "") : null,
      summary: get("summary"),
    });
  }
  return out;
}

function serializeRegistry(projects: Project[]): string {
  const head =
    "---\nsource: curly-os\n---\n\n# Projects\n\nThe registry behind the OS Projects workspace. Edit freely — one `##` block per project.\n";
  const blocks = projects
    .map(
      (p) =>
        `## ${p.name}\n- slug: ${p.slug}\n- status: ${p.status}\n- dir: ${p.dir ?? ""}\n- summary: ${p.summary}`,
    )
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
      out.push({
        slug,
        name: prettyName(slug),
        status: "active",
        dir: `${ACTIVE_DIR}/${slug}`,
        summary: "",
      });
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

// Scaffold projects/active/<slug>/ from the 7-file template and register it.
// Pass opts.slug to fill an existing folderless registry entry (keeps its slug).
export async function createProject(
  name: string,
  opts: { slug?: string } = {},
): Promise<{ ok: boolean; slug: string; dir: string; reason?: string }> {
  const slug = opts.slug || slugify(name);
  const dir = `${ACTIVE_DIR}/${slug}`;
  if (await exists(dir)) {
    return { ok: false, slug, dir, reason: "already exists" };
  }

  // Copy template files (fall back to a minimal set if the template is missing).
  let templateFiles: string[] = [];
  try {
    templateFiles = (await fs.readdir(resolveInVault(TEMPLATE_DIR))).filter((f) => f.endsWith(".md"));
  } catch {
    /* no template */
  }
  await fs.mkdir(resolveInVault(dir), { recursive: true });

  if (templateFiles.length) {
    for (const f of templateFiles) {
      const body = await fs.readFile(resolveInVault(`${TEMPLATE_DIR}/${f}`), "utf8");
      const seeded = f.toLowerCase() === "readme.md" ? `# ${name}\n\n${body}` : body;
      await fs.writeFile(resolveInVault(`${dir}/${f}`), seeded, "utf8");
    }
  } else {
    await fs.writeFile(
      resolveInVault(`${dir}/README.md`),
      `# ${name}\n\nNew project.\n`,
      "utf8",
    );
    await fs.writeFile(resolveInVault(`${dir}/tasks.md`), `# Tasks\n\n## Tasks\n`, "utf8");
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
    ? projects.map((p) => (p.slug === slug ? { ...p, dir } : p))
    : [
        ...projects,
        { slug, name, status: "active", dir, summary: "" },
      ];
  await saveVaultNote(REGISTRY_REL, serializeRegistry(next));

  return { ok: true, slug, dir };
}
