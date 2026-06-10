"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { KNOWN_STATUSES, PROJECT_TYPES, PROJECT_TYPE_ORDER, type ProjectType } from "@/lib/project-types";

export type ProjectMeta = {
  slug: string;
  name: string;
  summary: string;
  status: string;
  type: ProjectType;
  codeDir: string | null;
  emoji: string | null;
  links: { label: string; url: string }[];
  archived: boolean;
};

// Inline metadata editor for a project — name/summary/status/type/code/emoji/
// links/archived. PATCHes /api/projects/[slug] then refreshes the page.
export function ProjectMetaEditor({ project }: { project: ProjectMeta }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [name, setName] = useState(project.name);
  const [summary, setSummary] = useState(project.summary);
  const [status, setStatus] = useState(project.status);
  const [type, setType] = useState<ProjectType>(project.type);
  const [emoji, setEmoji] = useState(project.emoji ?? "");
  const [code, setCode] = useState(project.codeDir ?? "");
  const [archived, setArchived] = useState(project.archived);
  const [links, setLinks] = useState<{ label: string; url: string }[]>(project.links);

  async function save() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/projects/${project.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || project.name,
          summary: summary.trim(),
          status: status.trim() || "active",
          type,
          emoji: emoji.trim() || null,
          code: code.trim(),
          archived,
          links: links.filter((l) => l.url.trim()).map((l) => ({ label: l.label.trim(), url: l.url.trim() })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErr(data.reason || "Could not save");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setErr("Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        Edit
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Edit project">
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="w-16 shrink-0">
              <label className="mb-1 block text-xs font-medium text-subtle">Emoji</label>
              <Input value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="🎨" disabled={busy} className="text-center" />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-subtle">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} disabled={busy} />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-subtle">Summary</label>
            <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={2} resize="y" disabled={busy} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-subtle">Status</label>
              <Input
                list="known-statuses"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                disabled={busy}
              />
              <datalist id="known-statuses">
                {KNOWN_STATUSES.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-subtle">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as ProjectType)}
                disabled={busy}
                className="min-h-10 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
              >
                {PROJECT_TYPE_ORDER.map((t) => (
                  <option key={t} value={t}>
                    {PROJECT_TYPES[t].emoji} {PROJECT_TYPES[t].label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {PROJECT_TYPES[type].wantsCodeDir && (
            <div>
              <label className="mb-1 block text-xs font-medium text-subtle">
                Code repo <span className="text-muted">(inside ~/code)</span>
              </label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="~/code/my-app" disabled={busy} />
            </div>
          )}

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-medium text-subtle">Links</label>
              <button
                type="button"
                className="text-xs text-accent hover:underline"
                onClick={() => setLinks((l) => [...l, { label: "", url: "" }])}
                disabled={busy}
              >
                + add
              </button>
            </div>
            <div className="space-y-2">
              {links.map((l, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={l.label}
                    onChange={(e) => setLinks((arr) => arr.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                    placeholder="label"
                    disabled={busy}
                    className="w-28 shrink-0"
                  />
                  <Input
                    value={l.url}
                    onChange={(e) => setLinks((arr) => arr.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
                    placeholder="https://…"
                    disabled={busy}
                  />
                  <button
                    type="button"
                    aria-label="Remove link"
                    className="shrink-0 px-2 text-muted hover:text-danger"
                    onClick={() => setLinks((arr) => arr.filter((_, j) => j !== i))}
                    disabled={busy}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-subtle">
            <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} disabled={busy} />
            Archived
          </label>

          {err && <p className="text-xs text-danger">{err}</p>}

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => void save()} loading={busy}>
              Save
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
