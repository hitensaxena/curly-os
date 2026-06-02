"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";

// A gentle daily check-in. Writes a dated block to today's journal (NEVER to
// health/). No tracking pressure — just a place to note how things are.
const LEVELS = ["low", "ok", "good"] as const;
type Level = (typeof LEVELS)[number];

export function CareCheckin() {
  const [mood, setMood] = useState<Level | null>(null);
  const [energy, setEnergy] = useState<Level | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    if (busy) return;
    if (!mood && !energy && !note.trim()) return;
    setBusy(true);
    setDone(false);
    const parts: string[] = [];
    if (mood) parts.push(`mood: ${mood}`);
    if (energy) parts.push(`energy: ${energy}`);
    const head = parts.length ? `Check-in — ${parts.join(", ")}.` : "Check-in.";
    const content = note.trim() ? `${head}\n\n${note.trim()}` : head;
    try {
      const res = await fetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "journal", content }),
      });
      const data = await res.json();
      if (data.ok) {
        setDone(true);
        setNote("");
        setMood(null);
        setEnergy(null);
      }
    } finally {
      setBusy(false);
    }
  }

  const Chips = ({
    value,
    onPick,
    label,
  }: {
    value: Level | null;
    onPick: (l: Level) => void;
    label: string;
  }) => (
    <div className="flex items-center gap-2">
      <span className="w-14 text-xs text-muted">{label}</span>
      {LEVELS.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => onPick(l)}
          className={`rounded-full border px-3 py-1 text-xs capitalize transition-colors ${
            value === l
              ? "border-accent bg-accent-soft text-foreground"
              : "border-border text-muted hover:bg-surface-2"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-3">
      <Chips label="Mood" value={mood} onPick={setMood} />
      <Chips label="Energy" value={energy} onPick={setEnergy} />
      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        resize="y"
        placeholder="Anything you want to note (optional)…"
        disabled={busy}
      />
      <div className="flex items-center gap-3">
        <Button size="sm" onClick={() => void submit()} disabled={busy || (!mood && !energy && !note.trim())}>
          {busy ? "Saving…" : "Check in"}
        </Button>
        {done && <span className="text-xs text-accent-2">Noted in today&apos;s journal.</span>}
      </div>
    </div>
  );
}
