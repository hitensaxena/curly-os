// Pure GFM checkbox parse/serialize for project task lists. The vault has ZERO
// live checkboxes today; these are introduced ONLY inside project files, opt-in.
// Callers read a note, transform with these, and persist via saveVaultNote.

export interface Task {
  line: number; // 0-based line index in the source markdown
  text: string;
  done: boolean;
  indent: string;
}

const TASK_RE = /^(\s*)- \[([ xX])\]\s+(.*)$/;

export function parseTasks(md: string): Task[] {
  const out: Task[] = [];
  md.split("\n").forEach((l, i) => {
    const m = l.match(TASK_RE);
    if (m) {
      out.push({ line: i, indent: m[1], done: m[2].toLowerCase() === "x", text: m[3].trim() });
    }
  });
  return out;
}

export function toggleTask(md: string, line: number, done: boolean): string {
  const lines = md.split("\n");
  const m = lines[line]?.match(TASK_RE);
  if (!m) return md;
  lines[line] = `${m[1]}- [${done ? "x" : " "}] ${m[3]}`;
  return lines.join("\n");
}

// Append a new unchecked task under a `## Tasks` heading (created if absent).
export function addTask(md: string, text: string): string {
  const clean = text.trim().replace(/\s*\n\s*/g, " ");
  if (!clean) return md;
  const item = `- [ ] ${clean}`;
  const lines = md.split("\n");
  const headingIdx = lines.findIndex((l) => /^##\s+tasks\b/i.test(l.trim()));

  if (headingIdx === -1) {
    return `${md.replace(/\s*$/, "")}\n\n## Tasks\n\n${item}\n`;
  }
  // Insert after the last existing task line under the heading (else right after it).
  let insertAt = headingIdx + 1;
  for (let i = headingIdx + 1; i < lines.length; i++) {
    if (/^#{1,6}\s/.test(lines[i])) break; // next heading ends the block
    if (TASK_RE.test(lines[i])) insertAt = i + 1;
  }
  lines.splice(insertAt, 0, item);
  return lines.join("\n");
}
