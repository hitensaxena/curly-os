"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeading } from "@/components/ui/PageHeading";

const API = "";

// ── Helpers ──────────────────────────────────────────────────────────────────

function statusColor(s: string): string {
  if (s === "canonical") return "text-green-400";
  if (s === "belief") return "text-blue-400";
  if (s === "hypothesis") return "text-yellow-400";
  if (s === "possible_world") return "text-purple-400";
  if (s === "seed" || s === "conjecture") return "text-orange-400";
  return "text-muted";
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  const t = new Date(d);
  return isNaN(t.getTime()) ? "—" : t.toLocaleDateString();
}

function loadBand(v: number): { label: string; bar: string; text: string } {
  if (v >= 0.66) return { label: "high", bar: "bg-danger", text: "text-danger" };
  if (v >= 0.33) return { label: "moderate", bar: "bg-yellow-400", text: "text-yellow-400" };
  return { label: "low", bar: "bg-green-400", text: "text-green-400" };
}

const SIGNAL_CLS: Record<string, string> = {
  value_action_gap: "border-amber-800/40 bg-amber-900/20 text-amber-300",
  fulfillment: "border-green-800/40 bg-green-900/20 text-green-300",
  regret: "border-red-800/40 bg-red-900/20 text-red-300",
};

function SectionHeader({
  title,
  href,
  label,
}: {
  title: string;
  href: string;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <Link
        href={href}
        className="text-[11px] text-muted hover:text-accent transition-colors"
      >
        → {label}
      </Link>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SelfPage() {
  const [identity, setIdentity] = useState<any>(null);
  const [meta, setMeta] = useState<any>(null);
  const [narrative, setNarrative] = useState<any>(null);
  const [attention, setAttention] = useState<any>(null);
  const [reflection, setReflection] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/identity`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch(`${API}/api/cognition/meta`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch(`${API}/api/cognition/narrative`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch(`${API}/api/cognition/attention`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch(`${API}/api/cognition/reflection`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]).then(([id, m, nar, att, ref]) => {
      setIdentity(id);
      setMeta(m);
      setNarrative(nar);
      setAttention(att);
      setReflection(ref);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted">
        Loading self-model…
      </div>
    );
  }

  // Build identity key set for cross-link with reflection candidates
  const identityKeySet = new Set<string>(
    (identity?.items ?? []).map((f: any) =>
      `${f.predicate}::${f.object}`.toLowerCase()
    )
  );

  // Derived slices
  const topIdentity: any[] = [...(identity?.items ?? [])]
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 10);

  const principles: any[] = [...(meta?.principles ?? [])]
    .sort((a: any, b: any) => {
      if (a.epistemic_status === "canonical" && b.epistemic_status !== "canonical") return -1;
      if (b.epistemic_status === "canonical" && a.epistemic_status !== "canonical") return 1;
      return 0;
    })
    .slice(0, 6);

  // Guard against raw chat turns that leaked into life_chapters — pick the
  // newest chapter that reads like an actual chapter title, not a transcript.
  const looksLikeTurn = (t: string) =>
    !t ||
    /^\[turn\b/i.test(t) ||
    /\b(user|assistant):/i.test(t) ||
    /the user sent/i.test(t) ||
    /session (ended|started)/i.test(t) ||
    /messages?\s+processed/i.test(t) ||
    t.length > 80;
  const currentChapter: any | null =
    (narrative?.chapters ?? []).find((c: any) => !looksLikeTurn(String(c?.title ?? ""))) ?? null;

  const topThemes: any[] = [...(narrative?.themes ?? [])]
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 12);

  const cogLoad = attention?.cognitive_load ?? null;
  const topGaps: any[] = [...(attention?.alignment_gaps ?? [])]
    .sort((a, b) => (b.severity ?? 0) - (a.severity ?? 0))
    .slice(0, 4);

  const latestReport: any | null = reflection?.reports?.[0] ?? null;

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8">
      <PageHeading
        title="Self"
        subtitle="Who you are right now — synthesized from memory, reflection, and alignment."
      />

      <div className="space-y-5">
        {/* Row 1: Identity + Principles (side by side on large screens) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* 1. Identity */}
          <div className="rounded-lg border border-border bg-surface p-5">
            <SectionHeader title="Identity" href="/identity" label="/identity" />
            {topIdentity.length > 0 ? (
              <div className="space-y-2">
                {topIdentity.map((f: any) => (
                  <div key={f.id}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-foreground">
                        <span className="font-mono text-accent">{f.predicate}</span>
                        {" = "}
                        <span>{f.object}</span>
                      </span>
                      {f.epistemic_status && (
                        <span className={`text-[10px] font-mono shrink-0 ${statusColor(f.epistemic_status)}`}>
                          {f.epistemic_status}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex-1 h-1 rounded-full bg-surface-2 overflow-hidden max-w-[120px]">
                        <div
                          className="h-full rounded-full bg-accent"
                          style={{ width: `${f.confidence * 100}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted font-mono">
                        {f.confidence.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">—</p>
            )}
          </div>

          {/* 2. Principles */}
          <div className="rounded-lg border border-border bg-surface p-5">
            <SectionHeader title="Principles I live by" href="/cognition#meta" label="/cognition" />
            {principles.length > 0 ? (
              <div className="space-y-2">
                {principles.map((p: any) => (
                  <div key={p.id} className="rounded border border-border bg-surface-2 px-3 py-2">
                    <p className="text-sm text-foreground">{p.statement}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {p.domain && (
                        <span className="text-[10px] text-muted">{p.domain}</span>
                      )}
                      {p.epistemic_status && (
                        <span className={`text-[10px] font-mono ${statusColor(p.epistemic_status)}`}>
                          {p.epistemic_status}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">—</p>
            )}
          </div>
        </div>

        {/* Row 2: Current chapter + Themes (side by side on large screens) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* 3. Current chapter */}
          <div className="rounded-lg border border-border bg-surface p-5">
            <SectionHeader title="Current chapter" href="/cognition#narrative" label="/cognition" />
            {currentChapter ? (
              <div>
                <p className="text-sm font-medium text-foreground">{currentChapter.title}</p>
                {currentChapter.summary && (
                  <p className="text-xs text-muted mt-1 leading-relaxed">{currentChapter.summary}</p>
                )}
                <div className="text-[10px] text-muted mt-2">
                  {fmtDate(currentChapter.start_date)}
                  {" → "}
                  {currentChapter.end_date ? fmtDate(currentChapter.end_date) : "present"}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted">—</p>
            )}
          </div>

          {/* 4. Themes */}
          <div className="rounded-lg border border-border bg-surface p-5">
            <SectionHeader title="Themes" href="/cognition#narrative" label="/cognition" />
            {topThemes.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {topThemes.map((t: any) => (
                  <Link
                    key={t.id}
                    href={`/search?q=${encodeURIComponent(t.name)}`}
                    className="rounded border border-border bg-surface-2 px-2.5 py-1 text-[11px] text-foreground hover:border-accent hover:text-accent transition-colors"
                  >
                    {t.name}
                    <span className="ml-1.5 text-[10px] text-muted">{t.frequency}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">—</p>
            )}
          </div>
        </div>

        {/* Row 3: Alignment (full width) */}
        <div className="rounded-lg border border-border bg-surface p-5">
          <SectionHeader title="Alignment" href="/cognition#attention" label="/cognition" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Cognitive load gauge */}
            <div>
              <div className="text-xs text-muted font-semibold mb-2">Cognitive load</div>
              {cogLoad ? (
                <div className="rounded border border-border bg-surface-2 px-3 py-3">
                  {(() => {
                    const score = typeof cogLoad.score === "number" ? cogLoad.score : 0;
                    const pct = Math.round(score * 100);
                    const b = loadBand(score);
                    return (
                      <>
                        <div className="flex items-baseline justify-between mb-1.5">
                          <span className={`text-sm font-medium capitalize ${b.text}`}>{b.label}</span>
                          <span className="font-mono text-xs text-muted">{pct}%</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-surface">
                          <div
                            className={`h-full rounded-full ${b.bar}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </>
                    );
                  })()}
                </div>
              ) : (
                <p className="text-sm text-muted">—</p>
              )}
            </div>

            {/* Alignment gaps */}
            <div>
              <div className="text-xs text-muted font-semibold mb-2">Top alignment gaps</div>
              {topGaps.length > 0 ? (
                <div className="space-y-2">
                  {topGaps.map((g: any) => {
                    const sigCls =
                      SIGNAL_CLS[g.signal_type] ??
                      "border-border bg-surface-2 text-muted";
                    return (
                      <div key={g.id} className="rounded border border-border bg-surface-2 px-3 py-2">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`rounded border px-1.5 py-0.5 text-[10px] ${sigCls}`}
                          >
                            {g.signal_type ?? "signal"}
                          </span>
                        </div>
                        <p className="text-xs text-foreground">{g.description}</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted">—</p>
              )}
            </div>
          </div>
        </div>

        {/* Row 4: Latest reflection (full width) */}
        <div className="rounded-lg border border-border bg-surface p-5">
          <SectionHeader title="Latest reflection" href="/cognition#reflection" label="/cognition" />
          {latestReport ? (
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-semibold text-accent uppercase">
                  {latestReport.report_type}
                </span>
                <span className="text-[10px] text-muted">
                  {new Date(latestReport.created_at).toLocaleDateString()}
                </span>
              </div>
              {latestReport.summary && (
                <p className="text-sm text-muted mb-3 leading-relaxed">{latestReport.summary}</p>
              )}
              {latestReport.identity_candidates?.length > 0 && (
                <div>
                  <div className="text-xs text-muted font-semibold mb-2">Identity candidates</div>
                  <div className="space-y-1.5">
                    {latestReport.identity_candidates.map((c: any, i: number) => {
                      const key = `${c.predicate}::${c.object}`.toLowerCase();
                      const adopted = identityKeySet.has(key);
                      return (
                        <div key={i} className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm text-foreground">
                            <span className="font-mono text-accent">{c.predicate}</span>
                            {" = "}
                            <span>{c.object}</span>
                          </span>
                          <span className="text-[10px] text-muted font-mono">
                            ({typeof c.confidence === "number" ? c.confidence.toFixed(2) : c.confidence})
                          </span>
                          {adopted ? (
                            <span className="rounded border border-green-800/40 bg-green-900/20 px-1.5 py-0.5 text-[10px] text-green-400">
                              adopted
                            </span>
                          ) : (
                            <span className="rounded border border-border bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted">
                              pending
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted">—</p>
          )}
        </div>
      </div>
    </div>
  );
}
