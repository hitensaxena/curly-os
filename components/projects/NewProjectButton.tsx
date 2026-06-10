"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { PROJECT_TYPES, PROJECT_TYPE_ORDER, type ProjectType } from "@/lib/project-types";

// Create a new project (scaffolds projects/active/<slug>/ from the per-type
// template + registers it) and, if the registry note doesn't exist yet, offer
// to save the current inferred list as an editable note.
export function NewProjectButton({ hasRegistry }: { hasRegistry: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<ProjectType>("generic");
  const [summary, setSummary] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function reset() {
    setName("");
    setType("generic");
    setSummary("");
    setCode("");
    setErr(null);
  }

  async function create() {
    const v = name.trim();
    if (!v || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          name: v,
          type,
          summary: summary.trim() || undefined,
          code: PROJECT_TYPES[type].wantsCodeDir && code.trim() ? code.trim() : undefined,
        }),
      });
      const data = await res.json();
      if (data.ok && data.slug) {
        setOpen(false);
        reset();
        router.push(`/projects/${data.slug}`);
        router.refresh();
      } else {
        setErr(data.reason || "Could not create project");
      }
    } catch {
      setErr("Could not create project");
    } finally {
      setBusy(false);
    }
  }

  async function seed() {
    setBusy(true);
    try {
      await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seed" }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        + New project
      </Button>
      {!hasRegistry && (
        <button
          type="button"
          onClick={() => void seed()}
          disabled={busy}
          className="text-xs text-muted hover:text-foreground hover:underline"
        >
          Make editable
        </button>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New project">
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-subtle">Name</label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void create();
                }
              }}
              placeholder="Project name…"
              disabled={busy}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-subtle">Type</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {PROJECT_TYPE_ORDER.map((t) => {
                const meta = PROJECT_TYPES[t];
                const active = t === type;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                      active
                        ? "border-accent/60 bg-accent/10 text-foreground"
                        : "border-border bg-surface text-subtle hover:bg-surface-2"
                    }`}
                  >
                    <span aria-hidden className="text-base leading-none">{meta.emoji}</span>
                    <span className="truncate">{meta.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {PROJECT_TYPES[type].wantsCodeDir && (
            <div>
              <label className="mb-1 block text-xs font-medium text-subtle">
                Code repo <span className="text-muted">(optional — must be inside ~/code)</span>
              </label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="~/code/my-app"
                disabled={busy}
              />
              <p className="mt-1 text-[11px] text-muted">Curly will develop here in this project&apos;s chat.</p>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-subtle">Summary <span className="text-muted">(optional)</span></label>
            <Textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={2}
              resize="y"
              placeholder="One line about this project…"
              disabled={busy}
            />
          </div>

          {err && <p className="text-xs text-danger">{err}</p>}

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => void create()} disabled={busy || !name.trim()} loading={busy}>
              Create
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
