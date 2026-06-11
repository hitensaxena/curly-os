"use client";

import { useEffect, useState } from "react";

const API = "";

type Tab = "meta" | "reflection" | "attention" | "narrative";

export default function CognitionPage() {
  const [tab, setTab] = useState<Tab>("meta");
  const [meta, setMeta] = useState<any>(null);
  const [reflection, setReflection] = useState<any>(null);
  const [attention, setAttention] = useState<any>(null);
  const [narrative, setNarrative] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Narrative compose box (POST /api/cognition/narrative/compose).
  const [composeQuery, setComposeQuery] = useState("");
  const [composeResult, setComposeResult] = useState<any>(null);
  const [composing, setComposing] = useState(false);

  async function runCompose() {
    const q = composeQuery.trim();
    if (!q || composing) return;
    setComposing(true);
    setComposeResult(null);
    try {
      const r = await fetch(`${API}/api/cognition/narrative/compose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      setComposeResult(await r.json());
    } catch {
      setComposeResult({ narrative: "Couldn't compose a narrative right now." });
    } finally {
      setComposing(false);
    }
  }

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/cognition/meta`).then((r) => r.json()),
      fetch(`${API}/api/cognition/reflection`).then((r) => r.json()),
      fetch(`${API}/api/cognition/attention`).then((r) => r.json()),
      fetch(`${API}/api/cognition/narrative`).then((r) => r.json()),
    ]).then(([m, ref, att, nar]) => {
      setMeta(m);
      setReflection(ref);
      setAttention(att);
      setNarrative(nar);
      setLoading(false);
    });
  }, []);

  // Deep-link to a tab via #hash (e.g. /cognition#attention from the Self view).
  useEffect(() => {
    const h = typeof window !== "undefined" ? window.location.hash.replace("#", "") : "";
    if (h === "meta" || h === "reflection" || h === "attention" || h === "narrative") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTab(h);
    }
  }, []);

  const tabs: { id: Tab; label: string }[] = [
    { id: "meta", label: "Meta-Cognition" },
    { id: "reflection", label: "Reflection" },
    { id: "attention", label: "Attention" },
    { id: "narrative", label: "Narrative" },
  ];

  if (loading) return <div className="flex items-center justify-center h-64 text-muted">Loading...</div>;

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8">
      <h1 className="text-2xl font-bold text-foreground mb-1">Cognition</h1>
      <p className="text-sm text-muted mb-6">Meta-cognition, reflection, attention, narrative</p>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-border">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm border-b-2 transition-colors ${tab === t.id ? "border-accent text-foreground" : "border-transparent text-muted hover:text-foreground"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Meta-Cognition */}
      {tab === "meta" && (
        <div className="space-y-6">
          {/* Principles */}
          <section>
            <h2 className="text-sm font-semibold text-foreground mb-2">Principles</h2>
            {meta?.principles?.length > 0 ? (
              <div className="space-y-2">
                {meta.principles.map((p: any) => (
                  <div key={p.id} className="rounded-lg border border-border bg-surface px-4 py-3">
                    <p className="text-sm text-foreground">{p.statement}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-muted">{p.domain}</span>
                      <span className={`text-[10px] ${p.epistemic_status === "canonical" ? "text-green-400" : "text-yellow-400"}`}>
                        {p.epistemic_status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted">No principles yet.</p>}
          </section>

          {/* Assumptions */}
          <section>
            <h2 className="text-sm font-semibold text-foreground mb-2">Assumptions</h2>
            {meta?.assumptions?.length > 0 ? (
              <div className="space-y-2">
                {meta.assumptions.map((a: any) => (
                  <div key={a.id} className="rounded-lg border border-border bg-surface px-4 py-3">
                    <p className="text-sm text-foreground">{a.statement}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-muted">{a.domain}</span>
                      <span className="text-[10px] text-muted">conf={a.confidence.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted">No assumptions yet.</p>}
          </section>

          {/* Mental models */}
          <section>
            <h2 className="text-sm font-semibold text-foreground mb-2">Mental models</h2>
            {meta?.mental_models?.length > 0 ? (
              <div className="space-y-2">
                {meta.mental_models.map((m: any) => (
                  <div key={m.id} className="rounded-lg border border-border bg-surface px-4 py-3">
                    <p className="text-sm font-medium text-foreground">{m.name}</p>
                    <p className="text-sm text-muted mt-0.5">{m.description}</p>
                    <span className="text-[10px] text-muted">{m.domain}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted">No mental models yet.</p>}
          </section>

          {/* Decision Audits */}
          <section>
            <h2 className="text-sm font-semibold text-foreground mb-2">Decision Audits</h2>
            {meta?.decision_audits?.length > 0 ? (
              <div className="space-y-2">
                {meta.decision_audits.map((d: any) => (
                  <div key={d.id} className="rounded-lg border border-border bg-surface px-4 py-3">
                    <p className="text-sm text-foreground">{d.decision}</p>
                    <div className="text-[10px] text-muted">{d.domain}</div>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted">No decision audits yet.</p>}
          </section>
        </div>
      )}

      {/* Reflection */}
      {tab === "reflection" && (
        <div className="space-y-4">
          {reflection?.reports?.length > 0 ? (
            reflection.reports.map((r: any) => (
              <div key={r.id} className="rounded-lg border border-border bg-surface p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-accent uppercase">{r.report_type}</span>
                  <span className="text-[10px] text-muted">{new Date(r.created_at).toLocaleDateString()}</span>
                </div>
                <p className="text-sm text-muted mb-3">{r.summary}</p>
                {r.findings?.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs text-muted font-semibold">Findings:</div>
                    {r.findings.map((f: any, i: number) => (
                      <div key={i} className="text-sm text-foreground pl-2 border-l-2 border-accent/30">
                        {f.statement} <span className="text-[10px] text-muted">(conf={f.confidence})</span>
                      </div>
                    ))}
                  </div>
                )}
                {r.identity_candidates?.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="text-xs text-muted font-semibold">Identity Candidates:</div>
                    {r.identity_candidates.map((ic: any, i: number) => (
                      <div key={i} className="text-sm text-foreground">
                        {ic.predicate} = {ic.object} <span className="text-[10px] text-muted">(conf={ic.confidence})</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          ) : <p className="text-sm text-muted">No reflection reports yet. Run weekly reflection to generate insights.</p>}
        </div>
      )}

      {/* Attention */}
      {tab === "attention" && (
        <div className="space-y-8">
          {/* Focus areas — cognitive mass from the knowledge graph */}
          <section>
            <h2 className="text-sm font-semibold text-foreground mb-1">Focus areas</h2>
            <p className="text-xs text-muted mb-3">
              Where your cognitive mass sits — the most-connected entities in your knowledge graph.
            </p>
            {attention?.focus_areas?.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {attention.focus_areas.map((f: any) => (
                  <span key={f.name} title={`${f.label} · ${f.weight} connections`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-sm text-foreground">
                    {f.name}
                    <span className="text-[10px] text-muted">{f.label}</span>
                    <span className="text-[10px] text-accent">{f.weight}</span>
                  </span>
                ))}
              </div>
            ) : <p className="text-sm text-muted">No focus areas yet.</p>}
          </section>

          {/* Alignment gaps — stated priorities getting little recent attention */}
          <section>
            <h2 className="text-sm font-semibold text-foreground mb-2">Alignment gaps</h2>
            <p className="text-xs text-muted mb-3">
              Goals &amp; values you&apos;ve stated that get little recent attention — said, but barely acted on.
            </p>
            {attention?.alignment_gaps?.length > 0 ? (
              <div className="space-y-2">
                {attention.alignment_gaps.map((g: any) => (
                  <AlignmentGap key={g.id} gap={g} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">No alignment gaps — your stated priorities all get recent attention.</p>
            )}
          </section>

          {/* Neglected — established entities drifting from attention */}
          <section>
            <h2 className="text-sm font-semibold text-foreground mb-1">Drifting from attention</h2>
            <p className="text-xs text-muted mb-3">
              Well-established people, projects &amp; ideas with no recent activity.
            </p>
            {attention?.neglected?.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {attention.neglected.map((n: any) => (
                  <span key={n.name} title={`${n.label} · ${n.weight} connections`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/5 px-3 py-1 text-sm text-foreground">
                    {n.name}
                    <span className="text-[10px] text-muted">{n.label}</span>
                  </span>
                ))}
              </div>
            ) : <p className="text-sm text-muted">Nothing notable drifting.</p>}
          </section>

          {/* Breadth — how scattered cognition is across domains */}
          <section>
            <h2 className="text-sm font-semibold text-foreground mb-1">Cognitive breadth</h2>
            <p className="text-xs text-muted mb-3">
              How widely your thinking spreads across kinds of things — and how much it concentrates in one.
            </p>
            {attention?.breadth ? (
              <CognitiveBreadth breadth={attention.breadth} />
            ) : (
              <p className="text-sm text-muted">No graph entities to measure breadth.</p>
            )}
          </section>

          {/* Cognitive load — recent mental tempo */}
          <section>
            <h2 className="text-sm font-semibold text-foreground mb-1">Cognitive load</h2>
            <p className="text-xs text-muted mb-3">
              Recent mental tempo — how densely packed and how scattered your last two weeks have been.
            </p>
            {attention?.cognitive_load ? (
              <CognitiveLoad load={attention.cognitive_load} />
            ) : (
              <p className="text-sm text-muted">Not enough recent activity to estimate load.</p>
            )}
          </section>
        </div>
      )}

      {/* Narrative */}
      {tab === "narrative" && (
        <div className="space-y-6">
          {/* Compose a narrative */}
          <section>
            <h2 className="text-sm font-semibold text-foreground mb-2">Compose a narrative</h2>
            <p className="text-xs text-muted mb-2">
              Ask for a woven story from your episodes and beliefs — e.g. &ldquo;how has my thinking on
              CurlyOS evolved?&rdquo;
            </p>
            <div className="flex gap-2">
              <input
                value={composeQuery}
                onChange={(e) => setComposeQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void runCompose();
                }}
                placeholder="What story should Curly compose?"
                className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <button
                onClick={() => void runCompose()}
                disabled={composing || !composeQuery.trim()}
                className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-fg disabled:opacity-40"
              >
                {composing ? "Composing…" : "Compose"}
              </button>
            </div>
            {composeResult?.narrative && (
              <div className="mt-3 rounded-lg border border-border bg-surface px-4 py-3">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {composeResult.narrative}
                </p>
                <div className="mt-2 text-[10px] text-muted">
                  {composeResult.sources ?? 0} episodes · {composeResult.memories_referenced ?? 0} memories
                  {composeResult.llm === false && " · heuristic (no model)"}
                </div>
              </div>
            )}
          </section>

          <section>
            <h2 className="text-sm font-semibold text-foreground mb-2">Life Chapters</h2>
            {narrative?.chapters?.length > 0 ? (
              <div className="space-y-2">
                {narrative.chapters.map((c: any) => (
                  <div key={c.id} className="rounded-lg border border-border bg-surface px-4 py-3">
                    <p className="text-sm font-medium text-foreground">{c.title}</p>
                    {c.summary && <p className="text-xs text-muted mt-1">{c.summary}</p>}
                    <div className="text-[10px] text-muted mt-1">
                      {fmtDate(c.start_date)} — {c.end_date ? fmtDate(c.end_date) : "present"}
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted">No chapters detected yet.</p>}
          </section>

          <section>
            <h2 className="text-sm font-semibold text-foreground mb-2">Themes</h2>
            {narrative?.themes?.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {narrative.themes.map((t: any) => (
                  <div key={t.id} className="rounded-lg border border-border bg-surface px-3 py-2">
                    <div className="text-sm text-foreground">{t.name}</div>
                    <div className="text-[10px] text-muted">freq: {t.frequency}</div>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted">No themes extracted yet.</p>}
          </section>
        </div>
      )}
    </div>
  );
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  const t = new Date(d);
  return isNaN(t.getTime()) ? "—" : t.toLocaleDateString();
}

// ── Attention dashboard pieces ───────────────────────────────────────────────

// Entity-type palette — kept in sync with the knowledge-graph view so a type
// reads the same colour everywhere.
const TYPE_COLORS: Record<string, string> = {
  Person: "#60a5fa",
  Organization: "#22d3ee",
  Project: "#f472b6",
  Tool: "#a78bfa",
  Skill: "#34d399",
  Concept: "#fbbf24",
  Place: "#fb923c",
  Event: "#fb7185",
  Health: "#f87171",
  Media: "#2dd4bf",
  Activity: "#a3e635",
  Other: "#6b7280",
};
const typeColor = (label: string) => TYPE_COLORS[label] || "#6b7280";

function band(v: number): { label: string; text: string; bar: string } {
  if (v >= 0.66) return { label: "high", text: "text-danger", bar: "bg-danger" };
  if (v >= 0.33) return { label: "moderate", text: "text-yellow-400", bar: "bg-yellow-400" };
  return { label: "low", text: "text-green-400", bar: "bg-green-400" };
}

function CognitiveBreadth({ breadth }: { breadth: any }) {
  const total: number = breadth.total_entities ?? 0;
  const distinct: number = breadth.distinct_types ?? 0;
  const conc: number = typeof breadth.concentration === "number" ? breadth.concentration : 0;
  const byType: Record<string, number> = breadth.by_type ?? {};
  // by_type arrives ordered by count DESC, so the first entry is the dominant type.
  const entries = Object.entries(byType) as [string, number][];
  const dominant = entries[0]?.[0] ?? "—";
  const TOP = 10;
  const shown = entries.slice(0, TOP);
  const rest = entries.slice(TOP);
  const restCount = rest.reduce((s, [, c]) => s + c, 0);
  const maxCount = entries.length ? entries[0][1] : 1;

  const spread =
    conc >= 0.5
      ? { label: "concentrated", text: "text-yellow-400",
          note: `over half of everything sits in ${dominant}` }
      : conc >= 0.3
      ? { label: "balanced", text: "text-green-400",
          note: `a clear focus on ${dominant} with real breadth around it` }
      : { label: "broad", text: "text-blue-400",
          note: `attention is spread widely, no single type dominates` };

  return (
    <div className="space-y-3">
      {/* Headline stats */}
      <div className="grid grid-cols-3 gap-2">
        <Stat value={distinct} label="distinct types" />
        <Stat value={total} label="entities" />
        <Stat value={`${Math.round(conc * 100)}%`} label={`in ${dominant}`} valueClass={spread.text} />
      </div>

      {/* Per-type distribution */}
      <div className="rounded-lg border border-border bg-surface px-4 py-3">
        <div className="space-y-2">
          {shown.map(([label, count]) => {
            const pct = total ? (count / total) * 100 : 0;
            const w = maxCount ? (count / maxCount) * 100 : 0;
            return (
              <div key={label} className="flex items-center gap-3">
                <span className="w-24 shrink-0 truncate text-xs text-foreground" title={label}>
                  {label}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full"
                    style={{ width: `${w}%`, backgroundColor: typeColor(label) }} />
                </div>
                <span className="w-16 shrink-0 text-right font-mono text-[10px] text-muted">
                  {count} · {pct.toFixed(0)}%
                </span>
              </div>
            );
          })}
          {rest.length > 0 && (
            <div className="flex items-center gap-3 pt-1 text-[10px] text-muted">
              <span className="w-24 shrink-0 truncate">+{rest.length} more</span>
              <span className="flex-1" />
              <span className="w-16 shrink-0 text-right font-mono">{restCount}</span>
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-muted">
        Cognition spans <span className="text-foreground">{distinct}</span> kinds of things —{" "}
        <span className={spread.text}>{spread.label}</span>: {spread.note}.
      </p>
    </div>
  );
}

function Stat({ value, label, valueClass = "text-foreground" }:
  { value: string | number; label: string; valueClass?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-center">
      <div className={`text-lg font-semibold ${valueClass}`}>{value}</div>
      <div className="text-[10px] text-muted">{label}</div>
    </div>
  );
}

function LoadComponent({ name, hint, value }: { name: string; hint: string; value: number }) {
  const pct = Math.round(value * 100);
  const b = band(value);
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-foreground">{name}</span>
        <span className={`font-mono text-[10px] ${b.text}`}>{pct}%</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div className={`h-full rounded-full ${b.bar}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-[10px] text-muted">{hint}</p>
    </div>
  );
}

function CognitiveLoad({ load }: { load: any }) {
  const score = typeof load.score === "number" ? load.score : 0;
  const pct = Math.round(score * 100);
  const b = band(score);
  const bk = load.breakdown ?? {};
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3">
      {/* Overall */}
      <div className="flex items-baseline justify-between">
        <span className={`text-sm font-medium capitalize ${b.text}`}>{b.label} load</span>
        <span className="font-mono text-xs text-muted">{pct}%</span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-2">
        <div className={`h-full rounded-full ${b.bar}`} style={{ width: `${pct}%` }} />
      </div>

      {/* Components — what's driving the score */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {typeof bk.density === "number" && (
          <LoadComponent name="Density" value={bk.density}
            hint="how packed your days are — captures per day" />
        )}
        {typeof bk.topic_switching === "number" && (
          <LoadComponent name="Topic switching" value={bk.topic_switching}
            hint="how often focus jumps between unrelated topics" />
        )}
      </div>

      {/* Provenance */}
      <div className="mt-3 border-t border-border pt-2 text-[10px] text-muted">
        score = 40% density + 60% topic switching
        {typeof bk.episode_count === "number" && <> · {bk.episode_count} episodes</>}
        {typeof bk.window_days === "number" && <> over {bk.window_days}d</>}
      </div>
    </div>
  );
}

const SIGNAL: Record<string, { label: string; cls: string }> = {
  value_action_gap: { label: "value–action gap", cls: "border-amber-800/40 bg-amber-900/20 text-amber-300" },
  goal_action_gap: { label: "goal–action gap", cls: "border-amber-800/40 bg-amber-900/20 text-amber-300" },
  fulfillment: { label: "fulfillment", cls: "border-green-800/40 bg-green-900/20 text-green-300" },
  regret: { label: "regret", cls: "border-red-800/40 bg-red-900/20 text-red-300" },
};

function AlignmentGap({ gap }: { gap: any }) {
  const sev = typeof gap.severity === "number" ? gap.severity : 0.5;
  const b = band(sev);
  const sig = SIGNAL[gap.signal_type] ?? {
    label: gap.signal_type ?? "signal",
    cls: "border-border bg-surface-2 text-muted",
  };
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3">
      <div className="mb-1 flex items-center gap-2">
        <span className={`rounded border px-1.5 py-0.5 text-[10px] ${sig.cls}`}>{sig.label}</span>
        <span className={`text-[10px] ${b.text}`}>severity {b.label} · {sev.toFixed(2)}</span>
        {gap.epistemic_status && <span className="ml-auto text-[10px] text-muted">{gap.epistemic_status}</span>}
      </div>
      <p className="text-sm text-foreground">{gap.description}</p>
    </div>
  );
}
