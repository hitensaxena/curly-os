"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { Task } from "@/lib/tasks";

// Light per-project task list. Checkboxes are written into the project's
// tasks.md (committed + reindexed server-side). Optimistic toggle; the server
// returns the re-parsed list as the source of truth.
export function TaskList({ slug, initial }: { slug: string; initial: Task[] }) {
  const [tasks, setTasks] = useState<Task[]>(initial);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function post(body: object): Promise<Task[] | null> {
    setError(null);
    const res = await fetch(`/api/projects/${slug}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 409) {
      setError("Changed elsewhere — reload.");
      return null;
    }
    if (!res.ok || !data.ok) {
      setError(data.reason || "failed");
      return null;
    }
    return data.tasks as Task[];
  }

  async function toggle(t: Task) {
    if (busy) return;
    setBusy(true);
    setTasks((ts) => ts.map((x) => (x.line === t.line ? { ...x, done: !x.done } : x)));
    const next = await post({ action: "toggle", line: t.line, done: !t.done });
    if (next) setTasks(next);
    else setTasks((ts) => ts.map((x) => (x.line === t.line ? { ...x, done: t.done } : x))); // revert
    setBusy(false);
  }

  async function add() {
    const v = text.trim();
    if (!v || busy) return;
    setBusy(true);
    const next = await post({ action: "add", text: v });
    if (next) {
      setTasks(next);
      setText("");
    }
    setBusy(false);
  }

  return (
    <div>
      <ul className="space-y-1">
        {tasks.length === 0 && <li className="text-sm text-muted">No tasks yet.</li>}
        {tasks.map((t) => (
          <li key={t.line} className="flex items-start gap-2.5">
            <button
              type="button"
              onClick={() => void toggle(t)}
              aria-pressed={t.done}
              className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border text-[10px] ${
                t.done
                  ? "border-success bg-success/20 text-success"
                  : "border-border hover:border-accent"
              }`}
            >
              {t.done ? "✓" : ""}
            </button>
            <span className={`text-sm ${t.done ? "text-muted line-through" : "text-foreground"}`}>
              {t.text}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void add();
            }
          }}
          placeholder="Add a task…"
          disabled={busy}
        />
        <Button size="sm" variant="secondary" onClick={() => void add()} disabled={busy || !text.trim()}>
          Add
        </Button>
      </div>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
