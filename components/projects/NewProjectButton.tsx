"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

// Create a new project (scaffolds projects/active/<slug>/ + registers it) and,
// if the registry note doesn't exist yet, offer to save the current inferred
// list as an editable note.
export function NewProjectButton({ hasRegistry }: { hasRegistry: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    const v = name.trim();
    if (!v || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", name: v }),
      });
      const data = await res.json();
      if (data.ok && data.slug) {
        router.push(`/projects/${data.slug}`);
        router.refresh();
      }
    } finally {
      setBusy(false);
      setOpen(false);
      setName("");
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
      {open ? (
        <>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void create();
              }
              if (e.key === "Escape") setOpen(false);
            }}
            placeholder="Project name…"
            className="w-48"
            disabled={busy}
          />
          <Button size="sm" onClick={() => void create()} disabled={busy || !name.trim()}>
            Create
          </Button>
        </>
      ) : (
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
          + New project
        </Button>
      )}
      {!hasRegistry && !open && (
        <button
          type="button"
          onClick={() => void seed()}
          disabled={busy}
          className="text-xs text-muted hover:text-foreground hover:underline"
        >
          Make editable
        </button>
      )}
    </div>
  );
}
