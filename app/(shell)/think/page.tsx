"use client";

// Think: only what needs you. Working set, contradictions, intentions, curiosity
// and the narrative you are living — plus the plans that used to be three
// separate top-level pages (goals, decisions, opportunities).

import GoalsPanel from "@/components/think/GoalsPanel";
import DecisionsPanel from "@/components/think/DecisionsPanel";
import OpportunitiesPanel from "@/components/think/OpportunitiesPanel";
import AdvancedPanel from "@/components/think/AdvancedPanel";
import {
  ContradictionsPanel,
  CuriosityPanel,
  IntentionsPanel,
  WorkingSetPanel,
} from "@/components/cognition/OperablePanels";
import Link from "next/link";
import { useEffect, useState } from "react";

const API = "";

type Tab =
  | "attention"
  | "plans"
  | "goals"
  | "decisions"
  | "opportunities"
  | "narrative"
  | "advanced";

const TABS: { id: Tab; label: string }[] = [
  { id: "attention", label: "Needs you" },
  { id: "narrative", label: "Narrative" },
  { id: "goals", label: "Goals" },
  { id: "decisions", label: "Decisions" },
  { id: "opportunities", label: "Opportunities" },
  { id: "advanced", label: "Advanced" },
];

export default function ThinkPage() {
  const [tab, setTab] = useState<Tab>("attention");
  const [narrative, setNarrative] = useState<any>(null);

  useEffect(() => {
    fetch(`${API}/api/cognition/narrative/current`, { signal: AbortSignal.timeout(10_000) })
      .then((r) => (r.ok ? r.json() : null))
      .then(setNarrative)
      .catch(() => setNarrative(null));
  }, []);

  useEffect(() => {
    const h = typeof window !== "undefined" ? window.location.hash.replace("#", "") : "";
    if (TABS.some((t) => t.id === h)) setTab(h as Tab);
  }, []);

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8">
      <h1 className="mb-1 text-2xl font-bold text-foreground">Think</h1>
      <p className="mb-5 text-sm text-muted">
        What the system wants your judgement on, and what you are building toward.
      </p>

      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors ${
              tab === t.id
                ? "border-accent text-foreground"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "attention" && (
        <div className="space-y-8">
          <IntentionsPanel />
          <ContradictionsPanel />
          <CuriosityPanel />
          <WorkingSetPanel />
        </div>
      )}

      {tab === "narrative" && (
        <section>
          {narrative?.chapter?.title ? (
            <>
              <h2 className="text-sm font-semibold text-foreground">{narrative.chapter.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">{narrative.chapter.summary}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {(narrative.themes ?? []).map((t: any) => (
                  <span
                    key={t.name}
                    className="rounded-full border border-border px-3 py-1 text-xs text-muted"
                  >
                    {t.name} <span className="text-muted/60">×{t.frequency}</span>
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted">No chapter has been composed yet.</p>
          )}
          <button
            onClick={() => setTab("advanced")}
            className="mt-6 inline-block text-xs text-muted hover:text-foreground"
          >
            advanced: meta-cognition, reflection and attention →
          </button>
        </section>
      )}

      {tab === "goals" && <GoalsPanel />}
      {tab === "decisions" && <DecisionsPanel />}
      {tab === "opportunities" && <OpportunitiesPanel />}
      {tab === "advanced" && <AdvancedPanel />}
    </div>
  );
}
