// Broad, sandboxed read/write access to the ~/mind vault for the OS surfaces
// (dashboard, notes browser/reader/editor, capture). SERVER-ONLY — opens files,
// shells out to git, and ingests into the brain. Never import from a client
// component; go through the /api/notes, /api/capture, /api/dashboard routes.
//
// Write semantics mirror curly-voice/src/tools/capture.ts so notes written by
// voice and by screen stay consistent: frontmatter (date/source), kebab-case
// slugs, dated append for journal-style dirs, per-file git commit, brain ingest
// + incremental reindex.
import { promises as fs } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import matter from "gray-matter";
import { VAULT } from "@/lib/paths";
import { brain } from "@/lib/brain";
import { triggerReindex } from "@/lib/reindex";

const pexec = promisify(execFile);

// The 22 top-level vault directories (from ~/mind/CLAUDE.md).
export const KNOWN_DIRS = [
  "ideas", "journals", "projects", "philosophy", "health", "relationships",
  "finances", "music", "dreams", "knowledge", "identity", "spirituality",
  "memoirs", "experiments", "systems", "prompts", "media", "agents",
  "timeline", "conversations", "ai-context", "archives",
] as const;

// Hidden from the browser by default: machine tooling/index + raw git history.
export const HIDDEN_DIRS = new Set(["systems", "archives"]);

// Never written to from the OS: machine-managed (systems) or sensitive
// personal content (health, memoirs) — matches mind's capture.py off-limits.
const READONLY_PREFIXES = ["systems/", "health/", "memoirs/"];

export type VaultNoteMeta = {
  rel: string;
  name: string;
  title: string;
  dir: string;
  mtime: number;
  size: number;
};

export type VaultDirMeta = { rel: string; name: string; count: number };

export type VaultListing = {
  rel: string;
  dirs: VaultDirMeta[];
  files: VaultNoteMeta[];
};

export type VaultNote = {
  rel: string;
  raw: string;
  body: string;
  frontmatter: Record<string, unknown>;
  title: string;
  mtime: number;
  writeable: boolean;
};

// ---- sandbox ----

export function resolveInVault(rel: string): string {
  const clean = (rel ?? "").replace(/^\/+/, "");
  if (clean.includes("..") || clean.includes("\0")) throw new Error("path escape");
  const full = path.resolve(VAULT, clean);
  if (full !== VAULT && !full.startsWith(VAULT + path.sep)) throw new Error("path escape");
  return full;
}

export function isVaultWriteable(rel: string): boolean {
  if (!rel.endsWith(".md")) return false;
  if (rel.includes("..")) return false;
  return !READONLY_PREFIXES.some((p) => rel === p.slice(0, -1) || rel.startsWith(p));
}

// ---- helpers ----

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 60) || "note"
  );
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function clockStamp(): string {
  return new Date().toTimeString().slice(0, 5); // HH:MM, box-local
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

// Read just the first chunk of a file — enough to extract a title without
// loading the whole note for every directory listing.
async function readHead(full: string, bytes = 2048): Promise<string> {
  const fh = await fs.open(full, "r");
  try {
    const buf = Buffer.alloc(bytes);
    const { bytesRead } = await fh.read(buf, 0, bytes, 0);
    return buf.subarray(0, bytesRead).toString("utf8");
  } finally {
    await fh.close();
  }
}

function titleFromContent(raw: string, name: string): string {
  const body = raw.replace(/^---\n[\s\S]*?\n---\n?/, "");
  const h = body.match(/^#\s+(.+)$/m)?.[1]?.trim();
  return h || name.replace(/\.md$/, "").replace(/[-_]/g, " ");
}

async function countMd(dirFull: string): Promise<number> {
  try {
    const entries = await fs.readdir(dirFull, { withFileTypes: true });
    let n = 0;
    for (const e of entries) {
      if (e.name.startsWith(".")) continue;
      if (e.isFile() && e.name.endsWith(".md")) n++;
      else if (e.isDirectory()) n += await countMd(path.join(dirFull, e.name));
    }
    return n;
  } catch {
    return 0;
  }
}

// ---- browse / read ----

export async function listVaultDir(rel = ""): Promise<VaultListing> {
  const full = resolveInVault(rel);
  const entries = await fs.readdir(full, { withFileTypes: true });
  const dirs: VaultDirMeta[] = [];
  const files: VaultNoteMeta[] = [];
  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    const childRel = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) {
      if (rel === "" && HIDDEN_DIRS.has(e.name)) continue;
      dirs.push({
        rel: childRel,
        name: e.name,
        count: await countMd(path.join(full, e.name)),
      });
    } else if (e.isFile() && e.name.endsWith(".md")) {
      const fp = path.join(full, e.name);
      const [st, head] = await Promise.all([fs.stat(fp), readHead(fp)]);
      files.push({
        rel: childRel,
        name: e.name,
        title: titleFromContent(head, e.name),
        dir: childRel.split("/")[0],
        mtime: st.mtimeMs,
        size: st.size,
      });
    }
  }
  dirs.sort((a, b) => a.name.localeCompare(b.name));
  files.sort((a, b) => b.mtime - a.mtime);
  return { rel, dirs, files };
}

export async function isVaultDir(rel: string): Promise<boolean> {
  try {
    return (await fs.stat(resolveInVault(rel))).isDirectory();
  } catch {
    return false;
  }
}

export async function readVaultNote(rel: string): Promise<VaultNote | null> {
  if (!rel.endsWith(".md")) return null;
  const full = resolveInVault(rel);
  try {
    const [raw, st] = await Promise.all([fs.readFile(full, "utf8"), fs.stat(full)]);
    const parsed = matter(raw);
    const title =
      (typeof parsed.data.title === "string" && parsed.data.title) ||
      parsed.content.match(/^#\s+(.+)$/m)?.[1]?.trim() ||
      path.basename(rel, ".md").replace(/[-_]/g, " ");
    return {
      rel,
      raw,
      body: parsed.content,
      frontmatter: parsed.data,
      title,
      mtime: st.mtimeMs,
      writeable: isVaultWriteable(rel),
    };
  } catch {
    return null;
  }
}

export async function noteTitle(rel: string): Promise<string> {
  const name = path.basename(rel);
  try {
    return titleFromContent(await readHead(resolveInVault(rel)), name);
  } catch {
    return name.replace(/\.md$/, "").replace(/[-_]/g, " ");
  }
}

// Full-text content search over the content vault (systems/archives excluded),
// one snippet per matching note. Prefers ripgrep, falls back to grep. Brain
// semantic search only covers ~100 nodes, so this is what makes the other
// ~1.2k notes findable by what's inside them.
export async function searchVaultContent(
  query: string,
  limit = 30,
): Promise<{ rel: string; snippet: string }[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const rgArgs = [
    "--no-heading", "--line-number", "--max-count", "1", "--color", "never",
    "-i", "-F", "--glob", "*.md", "--glob", "!systems/**", "--glob", "!archives/**",
    "--", q, ".",
  ];
  const grepArgs = [
    "-rinF", "--include=*.md", "--exclude-dir=systems", "--exclude-dir=archives",
    "--", q, ".",
  ];
  for (const [bin, args] of [["rg", rgArgs], ["grep", grepArgs]] as const) {
    try {
      const { stdout } = await pexec(bin, args, {
        cwd: VAULT,
        timeout: 8000,
        maxBuffer: 1 << 22,
      });
      const out: { rel: string; snippet: string }[] = [];
      const seen = new Set<string>();
      for (const line of stdout.split("\n")) {
        const m = line.match(/^\.?\/?(.+?\.md):\d+:(.*)$/);
        if (!m) continue;
        const rel = m[1];
        if (seen.has(rel)) continue;
        seen.add(rel);
        out.push({ rel, snippet: m[2].trim().slice(0, 160) });
        if (out.length >= limit) break;
      }
      return out;
    } catch (e) {
      if ((e as { code?: number })?.code === 1) return []; // ran, no matches
      // binary missing / other — try the next one
    }
  }
  return [];
}

// ---- dashboard ----

async function walkRecent(
  dirRel: string,
  out: { rel: string; mtime: number }[],
  depth = 0,
): Promise<void> {
  if (depth > 4) return;
  let entries;
  try {
    entries = await fs.readdir(resolveInVault(dirRel), { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    const childRel = dirRel ? `${dirRel}/${e.name}` : e.name;
    if (e.isDirectory()) {
      if (dirRel === "" && HIDDEN_DIRS.has(e.name)) continue;
      await walkRecent(childRel, out, depth + 1);
    } else if (e.isFile() && e.name.endsWith(".md")) {
      try {
        const st = await fs.stat(resolveInVault(childRel));
        out.push({ rel: childRel, mtime: st.mtimeMs });
      } catch {
        /* skip */
      }
    }
  }
}

// Most-recently-modified notes across the content vault (systems/archives
// skipped). Stats every candidate but only reads heads for the top N.
export async function recentNotes(limit = 8): Promise<VaultNoteMeta[]> {
  const cand: { rel: string; mtime: number }[] = [];
  await walkRecent("", cand);
  cand.sort((a, b) => b.mtime - a.mtime);
  const top = cand.slice(0, limit);
  return Promise.all(
    top.map(async (c) => {
      const name = path.basename(c.rel);
      let title = name.replace(/\.md$/, "").replace(/[-_]/g, " ");
      try {
        title = titleFromContent(await readHead(resolveInVault(c.rel)), name);
      } catch {
        /* keep fallback */
      }
      return { rel: c.rel, name, title, dir: c.rel.split("/")[0], mtime: c.mtime, size: 0 };
    }),
  );
}

export async function todayJournal(): Promise<{ rel: string; body: string } | null> {
  const rel = `journals/daily/${today()}.md`;
  try {
    const raw = await fs.readFile(resolveInVault(rel), "utf8");
    return { rel, body: matter(raw).content.trim() };
  } catch {
    return null;
  }
}

export async function lastJournal(): Promise<VaultNoteMeta | null> {
  try {
    const listing = await listVaultDir("journals/daily");
    return listing.files[0] ?? null;
  } catch {
    return null;
  }
}

// ---- write ----

async function commitFile(rel: string, message: string): Promise<boolean> {
  try {
    // Stage + commit ONLY this path. The vault has unrelated dirty files and a
    // background snapshot committer; `git add -A` would sweep them in.
    await pexec("git", ["-C", VAULT, "add", "--", rel], { timeout: 8000 });
    await pexec("git", ["-C", VAULT, "commit", "-m", message, "--", rel], { timeout: 8000 });
    return true;
  } catch {
    return false; // nothing to commit, or git hiccup — non-fatal
  }
}

async function ingestNote(rel: string, content: string): Promise<boolean> {
  try {
    const parsed = matter(content);
    const title =
      (typeof parsed.data.title === "string" && parsed.data.title) ||
      parsed.content.match(/^#\s+(.+)$/m)?.[1]?.trim() ||
      path.basename(rel, ".md").replace(/[-_]/g, " ");
    await brain.ingest({
      id: `mind:${rel}`,
      title,
      content: parsed.content || content,
      type: "note",
      tags: Array.isArray(parsed.data.tags) ? parsed.data.tags.map(String) : [],
      source_app: "curly-os",
      metadata: { vault_path: rel },
    });
    return true;
  } catch {
    return false;
  }
}

export type WriteResult = {
  ok: boolean;
  rel: string;
  committed: boolean;
  ingested: boolean;
  reason?: string;
};

// Persist edited markdown to an existing/new note, then commit + reindex +
// ingest. `expectedMtime` (optional) guards against clobbering a concurrent
// voice edit: returns ok:false reason:"conflict" if the file changed since read.
export async function saveVaultNote(
  rel: string,
  content: string,
  expectedMtime?: number,
): Promise<WriteResult> {
  if (!isVaultWriteable(rel)) {
    return { ok: false, rel, committed: false, ingested: false, reason: "not writeable" };
  }
  const full = resolveInVault(rel);
  if (expectedMtime != null) {
    try {
      const st = await fs.stat(full);
      if (Math.abs(st.mtimeMs - expectedMtime) > 1) {
        return { ok: false, rel, committed: false, ingested: false, reason: "conflict" };
      }
    } catch {
      /* new file — no conflict */
    }
  }
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, content, "utf8");
  const committed = await commitFile(rel, `curly-os: edit ${rel}`);
  const ingested = await ingestNote(rel, content);
  triggerReindex();
  return { ok: true, rel, committed, ingested };
}

// Append to today's daily journal (append-not-overwrite). Default block is a
// timestamped `### YYYY-MM-DD HH:MM`; a named `section` becomes a `## section`.
export async function appendToJournal(input: {
  content: string;
  section?: string;
}): Promise<WriteResult> {
  const date = today();
  const rel = `journals/daily/${date}.md`;
  const full = resolveInVault(rel);
  await fs.mkdir(path.dirname(full), { recursive: true });
  const heading = input.section ? `## ${input.section}` : `### ${date} ${clockStamp()}`;
  const block = `\n\n${heading}\n\n${input.content.trim()}\n`;
  let body: string;
  if (await exists(full)) {
    const prev = await fs.readFile(full, "utf8");
    body = prev.replace(/\s*$/, "") + block;
  } else {
    body = `---\ndate: ${date}\nsource: curly-os\n---\n\n# ${date}${block}`;
  }
  await fs.writeFile(full, body, "utf8");
  const committed = await commitFile(rel, `curly-os: journal ${date}`);
  const ingested = await ingestNote(rel, body);
  triggerReindex();
  return { ok: true, rel, committed, ingested };
}

// Append a dated section to an arbitrary writeable note (e.g. a project's
// journal.md). Sandboxed; creates the file if missing; commit + reindex + ingest.
export async function appendToNote(
  rel: string,
  content: string,
  heading?: string,
): Promise<WriteResult> {
  if (!isVaultWriteable(rel)) {
    return { ok: false, rel, committed: false, ingested: false, reason: "not writeable" };
  }
  const full = resolveInVault(rel);
  await fs.mkdir(path.dirname(full), { recursive: true });
  const date = today();
  const head = heading ? `## ${heading}` : `## ${date} ${clockStamp()}`;
  const block = `\n\n${head}\n\n${content.trim()}\n`;
  let body: string;
  if (await exists(full)) {
    const prev = await fs.readFile(full, "utf8");
    body = prev.replace(/\s*$/, "") + block;
  } else {
    const name = path.basename(rel, ".md").replace(/[-_]/g, " ");
    body = `---\ndate: ${date}\nsource: curly-os\n---\n\n# ${name}${block}`;
  }
  await fs.writeFile(full, body, "utf8");
  const committed = await commitFile(rel, `curly-os: note ${rel}`);
  const ingested = await ingestNote(rel, body);
  triggerReindex();
  return { ok: true, rel, committed, ingested };
}

// Full port of curly-voice remember(): new note in a chosen dir, dated filename
// for journal-style dirs, frontmatter + heading, append a dated section if it
// already exists.
export async function captureNote(input: {
  title?: string;
  content: string;
  directory?: string;
  tags?: string[];
}): Promise<WriteResult> {
  const dir =
    input.directory && (KNOWN_DIRS as readonly string[]).includes(input.directory)
      ? input.directory
      : "ideas";
  if (READONLY_PREFIXES.some((p) => `${dir}/`.startsWith(p))) {
    return { ok: false, rel: "", committed: false, ingested: false, reason: "directory not writeable" };
  }
  const date = today();
  const title = (input.title || input.content.split("\n")[0] || "note").slice(0, 80).trim();
  const slug = slugify(title);
  const dated = dir === "journals" || dir === "dreams" || dir === "conversations";
  const rel = `${dir}/${dated ? `${date}-${slug}` : slug}.md`;
  const full = resolveInVault(rel);
  await fs.mkdir(path.dirname(full), { recursive: true });
  const tagLine = input.tags?.length ? `tags: [${input.tags.join(", ")}]\n` : "";
  let body: string;
  if (await exists(full)) {
    const prev = await fs.readFile(full, "utf8");
    body = prev.replace(/\s*$/, "") + `\n\n## ${date} — ${title}\n\n${input.content.trim()}\n`;
  } else {
    body = `---\ndate: ${date}\nsource: curly-os\n${tagLine}---\n\n# ${title}\n\n${input.content.trim()}\n`;
  }
  await fs.writeFile(full, body, "utf8");
  const committed = await commitFile(rel, `curly-os: ${title}`);
  const ingested = await ingestNote(rel, body);
  triggerReindex();
  return { ok: true, rel, committed, ingested };
}
