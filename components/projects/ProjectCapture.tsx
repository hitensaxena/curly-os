"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";

// Capture a note/log into a project's journal.md (committed + reindexed).
export function ProjectCapture({ slug }: { slug: string }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit() {
    const content = text.trim();
    if (!content || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/projects/${slug}/capture`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.reason || "failed");
      setText("");
      setMsg("Added to project journal");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Textarea
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
        placeholder="Note, decision, or log for this project…"
        disabled={busy}
      />
      <div className="mt-2 flex items-center gap-3">
        <Button size="sm" onClick={() => void submit()} disabled={busy || !text.trim()}>
          {busy ? "Saving…" : "Add to journal"}
        </Button>
        <span className="text-xs text-muted">⌘↵</span>
        {msg && <span className="ml-auto text-xs text-accent-2">{msg}</span>}
      </div>
    </div>
  );
}
