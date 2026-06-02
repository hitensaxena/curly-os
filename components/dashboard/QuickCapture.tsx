"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { noteHref } from "@/lib/vault-paths";

// Dashboard capture box: appends a timestamped block to today's daily journal
// (the same target voice capture uses), commits + reindexes server-side. Cmd/
// Ctrl+Enter submits.
type Saved = { rel: string } | null;

export function QuickCapture() {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<Saved>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);

  async function submit() {
    const content = text.trim();
    if (!content || saving) return;
    setSaving(true);
    setError(null);
    setSaved(null);
    try {
      const res = await fetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "journal", content }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.reason || "capture failed");
      setText("");
      setSaved({ rel: data.rel });
      ref.current?.focus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "capture failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Capture</h2>
        <span className="text-xs text-muted">→ today&apos;s journal</span>
      </div>
      <Textarea
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            void submit();
          }
        }}
        rows={3}
        resize="y"
        placeholder="A thought, a note to self, what just happened…"
        disabled={saving}
      />
      <div className="mt-2 flex items-center gap-3">
        <Button size="sm" onClick={() => void submit()} disabled={saving || !text.trim()}>
          {saving ? "Saving…" : "Capture"}
        </Button>
        <span className="text-xs text-muted">⌘↵</span>
        {saved && (
          <a
            href={noteHref(saved.rel)}
            className="ml-auto truncate text-xs text-accent-2 hover:underline"
          >
            Saved → {saved.rel}
          </a>
        )}
        {error && <span className="ml-auto text-xs text-danger">{error}</span>}
      </div>
    </div>
  );
}
