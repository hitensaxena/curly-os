"use client";

import { useEffect, useMemo, useState, type SVGProps, type ReactElement } from "react";
import { BrainIcon, LayersIcon, CogIcon, UserIcon } from "@/components/shell/nav";

const API = "";
const PAGE = 25;

// ── The four kinds of memory CurlyOS holds ───────────────────────────────────
// These are the cognitive memory types, not storage tables. Their counts come
// from /api/stats + /api/stats/composition (DB-wide, accurate); their rows come
// from the endpoint each type is backed by:
//   semantic    → /api/memories            (facts & beliefs — the bulk)
//   episodic    → /api/episodes            (raw lived experiences / provenance)
//   procedural  → /api/memories?kind=procedure  (how-to knowledge)
//   identity    → /api/identity            (the self-model)
type TypeKey = "semantic" | "episodic" | "procedural" | "identity";

interface Memory {
  id: string;
  statement: string;
  kind: string;
  tier?: string;
  epistemic_status: string;
  valid_from: string;
  valid_to: string | null;
  source_episode_id: string;
  superseded_by: string | null;
}
interface Episode {
  id: string;
  content: string;
  source_ref: string | null;
  modality: string | null;
  ingested_at: string;
  created_at?: string;
}
interface IdentityFact {
  id: string;
  predicate: string;
  object: string;
  confidence: number;
  epistemic_status: string;
  valid_from: string;
  valid_to: string | null;
  source_episode_id: string;
  superseded_by: string | null;
}

interface TypeMeta {
  key: TypeKey;
  label: string;
  sub: string;
  Icon: (p: SVGProps<SVGSVGElement>) => ReactElement;
  text: string; // type accent text colour
  soft: string; // type accent soft background
  ring: string; // type accent border colour
  dot: string; // type accent solid dot
}

// Literal Tailwind class strings (so the JIT scanner picks them up — never build
// these by interpolation). Colours map to the four brand accents in globals.css.
const TYPES: TypeMeta[] = [
  { key: "semantic", label: "Semantic", sub: "Facts & beliefs", Icon: BrainIcon, text: "text-accent", soft: "bg-accent-soft", ring: "border-accent", dot: "bg-accent" },
  { key: "episodic", label: "Episodic", sub: "Lived experiences", Icon: LayersIcon, text: "text-accent-2", soft: "bg-accent-2-soft", ring: "border-accent-2", dot: "bg-accent-2" },
  { key: "procedural", label: "Procedural", sub: "Skills & how-to", Icon: CogIcon, text: "text-accent-warm", soft: "bg-accent-warm-soft", ring: "border-accent-warm", dot: "bg-accent-warm" },
  { key: "identity", label: "Identity", sub: "Self-model", Icon: UserIcon, text: "text-accent-3", soft: "bg-accent-3-soft", ring: "border-accent-3", dot: "bg-accent-3" },
];
const META = (k: TypeKey) => TYPES.find((t) => t.key === k)!;

// The epistemic spectrum, weakest → strongest. A memory's status is one point on
// this ladder; the detail panel shows where the selected memory sits.
const SPECTRUM = ["seed", "conjecture", "possible_world", "hypothesis", "belief", "canonical"];
const STATUS_TEXT: Record<string, string> = {
  canonical: "text-green-400",
  belief: "text-blue-400",
  hypothesis: "text-yellow-400",
  possible_world: "text-purple-400",
  conjecture: "text-orange-400",
  seed: "text-orange-300",
};
const STATUS_DOT: Record<string, string> = {
  canonical: "bg-green-400",
  belief: "bg-blue-400",
  hypothesis: "bg-yellow-400",
  possible_world: "bg-purple-400",
  conjecture: "bg-orange-400",
  seed: "bg-orange-300",
};
const statusColor = (s: string) => STATUS_TEXT[s] ?? "text-muted";

const isMemoryType = (t: TypeKey) => t === "semantic" || t === "procedural";

export default function MemoryPage() {
  const [type, setType] = useState<TypeKey>("semantic");

  // Overview (loaded once). proc + identity are small enough to hold whole.
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [comp, setComp] = useState<any>(null);
  const [proc, setProc] = useState<Memory[]>([]);
  const [identity, setIdentity] = useState<IdentityFact[]>([]);

  // Browser controls
  const [q, setQ] = useState("");
  const [epi, setEpi] = useState(""); // epistemic_status filter ("" = all)
  const [validity, setValidity] = useState<"current" | "superseded">("current");
  const [modality, setModality] = useState("");
  const [page, setPage] = useState(0);

  // Browser data
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);

  // Selection / detail
  const [selected, setSelected] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);

  // ── overview fetch (counts for the type tiles + state-of-mind bar) ──────────
  const loadOverview = () => {
    fetch(`${API}/api/stats`).then((r) => r.json()).then(setStats).catch(() => {});
    fetch(`${API}/api/stats/composition`).then((r) => r.json()).then(setComp).catch(() => {});
    fetch(`${API}/api/memories?kind=procedure&limit=200`).then((r) => r.json()).then((d) => setProc(d.items || [])).catch(() => {});
    fetch(`${API}/api/identity`).then((r) => r.json()).then((d) => setIdentity(d.items || [])).catch(() => {});
  };
  useEffect(loadOverview, [refresh]);

  // ── browser fetch — only the server-backed paginated types hit the network.
  // procedural/identity are held whole (proc/identity) and read straight from
  // `display`, so `rows` only ever holds semantic OR episodic items. The cancel
  // guard drops a stale in-flight response when the type/filters change mid-fetch
  // — otherwise the previous type's rows could land while a new type is active
  // and the list would render mismatched shapes (statement on an episode, …).
  useEffect(() => {
    if (type !== "semantic" && type !== "episodic") { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    const p = new URLSearchParams({ limit: String(PAGE), offset: String(page * PAGE) });
    let url: string;
    if (type === "semantic") {
      if (q) p.set("q", q);
      if (epi) p.set("epistemic_status", epi);
      if (validity === "superseded") p.set("valid", "false");
      url = `${API}/api/memories?${p}`;
    } else {
      if (modality) p.set("modality", modality);
      url = `${API}/api/episodes?${p}`;
    }
    fetch(url)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) { setRows(d.items || []); setLoading(false); } })
      .catch(() => { if (!cancelled) { setRows([]); setLoading(false); } });
    return () => { cancelled = true; };
  }, [type, q, epi, validity, modality, page, refresh]);

  // Switching type or any filter resets to the first page. Clear rows + selection
  // synchronously so the first render after a switch never shows the previous
  // type's items under the new type (which would crash the type-specific Row).
  const pick = (t: TypeKey) => {
    if (t === type) return;
    setType(t); setPage(0); setQ(""); setEpi(""); setValidity("current"); setModality("");
    setRows([]); setSelected(null); setDetail(null); setLoading(t === "semantic" || t === "episodic");
  };
  const onQ = (v: string) => { setQ(v); setPage(0); };
  const onEpi = (v: string) => { setEpi(v); setPage(0); };
  const onValidity = (v: "current" | "superseded") => { setValidity(v); setPage(0); };
  const onModality = (v: string) => { setModality(v); setPage(0); };

  // Client-side narrowing for the types we hold whole (procedural/identity) and
  // for episodic text search (the episodes endpoint has no q param).
  const display = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (type === "procedural") {
      return proc.filter((m) => {
        if (validity === "current" && m.valid_to) return false;
        if (validity === "superseded" && !m.valid_to) return false;
        if (epi && m.epistemic_status !== epi) return false;
        if (needle && !m.statement?.toLowerCase().includes(needle)) return false;
        return true;
      });
    }
    if (type === "identity") {
      return identity.filter((f) => {
        if (validity === "current" && f.valid_to) return false;
        if (validity === "superseded" && !f.valid_to) return false;
        if (needle && !`${f.predicate} ${f.object}`.toLowerCase().includes(needle)) return false;
        return true;
      });
    }
    if (type === "episodic") {
      return needle ? rows.filter((e: Episode) => e.content?.toLowerCase().includes(needle)) : rows;
    }
    return rows; // semantic — already filtered server-side
  }, [rows, proc, identity, type, q, epi, validity]);

  // True totals for the paginated (server-backed) types, from the overview.
  const counts: Record<TypeKey, number> = {
    semantic: comp?.memories_by_tier?.semantic ?? 0,
    episodic: stats?.episodes ?? 0,
    procedural: proc.length,
    identity: identity.length,
  };
  const paginated = type === "semantic" || type === "episodic";
  const total = paginated ? counts[type] : display.length;

  const select = (item: any) => {
    setSelected(item);
    setDetail(null);
    if (isMemoryType(type)) {
      fetch(`${API}/api/memories/${item.id}`).then((r) => r.json()).then(setDetail);
    } else if (type === "episodic") {
      fetch(`${API}/api/episodes/${item.id}`).then((r) => r.json()).then(setDetail);
    } else {
      setDetail(item); // identity facts carry everything inline
    }
  };

  const invalidate = async (id: string) => {
    await fetch(`${API}/api/memories/${id}/invalidate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "invalidated via web UI" }),
    });
    setSelected(null);
    setDetail(null);
    setRefresh((n) => n + 1); // reloads browser + overview counts
  };

  const meta = META(type);

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8">
      <h1 className="text-2xl font-bold text-foreground mb-1">Memory</h1>
      <p className="text-sm text-muted mb-6">
        Everything CurlyOS holds, by type — {(counts.semantic + counts.episodic + counts.procedural + counts.identity).toLocaleString()} traces across {TYPES.length} kinds.
      </p>

      {/* ── Type tiles — the dashboard's spine ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {TYPES.map((t) => {
          const active = type === t.key;
          return (
            <button
              key={t.key}
              onClick={() => pick(t.key)}
              className={`group rounded-xl border p-4 text-left transition-colors ${
                active ? `${t.ring} ${t.soft}` : "border-border bg-surface hover:border-border-soft"
              }`}
            >
              <div className="flex items-center justify-between">
                <t.Icon className={`h-5 w-5 ${active ? t.text : "text-muted group-hover:text-foreground"}`} />
                <span className={`h-1.5 w-1.5 rounded-full ${active ? t.dot : "bg-surface-3"}`} />
              </div>
              <div className={`mt-3 text-2xl font-semibold tabular-nums ${active ? t.text : "text-foreground"}`}>
                {counts[t.key].toLocaleString()}
              </div>
              <div className="text-sm text-foreground/90">{t.label}</div>
              <div className="text-[11px] text-muted">{t.sub}</div>
            </button>
          );
        })}
      </div>

      {/* ── State of mind — epistemic composition + recent churn ── */}
      <StateOfMind comp={comp} stats={stats} />

      {/* ── Browser controls (per active type) ── */}
      <div className="flex flex-col sm:flex-row gap-2 mt-6 mb-4">
        <input
          type="text"
          value={q}
          onChange={(e) => onQ(e.target.value)}
          placeholder={`Search ${meta.label.toLowerCase()} memory…`}
          className="flex-1 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent"
        />
        {(isMemoryType(type)) && (
          <select
            value={epi}
            onChange={(e) => onEpi(e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent"
          >
            <option value="">All statuses</option>
            {SPECTRUM.slice().reverse().map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )}
        {type === "episodic" && (
          <select
            value={modality}
            onChange={(e) => onModality(e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent"
          >
            <option value="">All modalities</option>
            {Array.from(new Set(rows.map((e: Episode) => e.modality).filter(Boolean) as string[])).sort().map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        )}
        {(isMemoryType(type) || type === "identity") && (
          <select
            value={validity}
            onChange={(e) => onValidity(e.target.value as "current" | "superseded")}
            className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent"
          >
            <option value="current">Current</option>
            <option value="superseded">Superseded</option>
          </select>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* List */}
        <div className="lg:col-span-2">
          {loading ? (
            <div className="text-muted text-sm">Loading…</div>
          ) : display.length === 0 ? (
            <div className="rounded-lg border border-border bg-surface p-6 text-sm text-muted text-center">
              {type === "procedural"
                ? "No procedural memory yet — how-to knowledge will land here as it's learned."
                : "No memories match."}
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-surface divide-y divide-border">
              {display.map((item: any) => (
                <Row key={item.id} item={item} type={type} meta={meta} selected={selected?.id === item.id} onClick={() => select(item)} />
              ))}
            </div>
          )}

          {/* Pagination — only the server-backed types page; client-held types show all.
              The total is only meaningful when nothing narrows the set (filters/search
              run server-side for semantic, client-side for episodic), so we hide it then. */}
          {paginated && (rows.length >= PAGE || page > 0) && (
            <div className="flex items-center justify-between mt-4 text-sm text-muted">
              <span>
                {page * PAGE + 1}–{page * PAGE + display.length}
                {(type === "semantic" ? !q && !epi && validity === "current" : !q && !modality) && ` of ${total.toLocaleString()}`}
              </span>
              <div className="flex gap-2">
                <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
                  className="px-3 py-1 rounded border border-border hover:border-accent disabled:opacity-30">← Prev</button>
                <button onClick={() => setPage(page + 1)} disabled={rows.length < PAGE}
                  className="px-3 py-1 rounded border border-border hover:border-accent disabled:opacity-30">Next →</button>
              </div>
            </div>
          )}
        </div>

        {/* Detail */}
        <div className="lg:col-span-1">
          {!selected ? (
            <div className="rounded-lg border border-border bg-surface p-4 text-sm text-muted text-center">
              Select a {meta.label.toLowerCase()} memory to view details
            </div>
          ) : isMemoryType(type) ? (
            <MemoryDetail selected={selected} detail={detail} meta={meta} onClose={() => { setSelected(null); setDetail(null); }} onInvalidate={invalidate} />
          ) : type === "episodic" ? (
            <EpisodeDetail selected={selected} detail={detail} onClose={() => { setSelected(null); setDetail(null); }} />
          ) : (
            <IdentityDetail fact={selected} onClose={() => { setSelected(null); setDetail(null); }} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── State-of-mind strip ──────────────────────────────────────────────────────
function StateOfMind({ comp, stats }: { comp: any; stats: Record<string, number> | null }) {
  const byStatus: Record<string, number> = comp?.memories_by_status ?? {};
  const ordered = SPECTRUM.slice().reverse().filter((s) => byStatus[s]);
  const sum = ordered.reduce((a, s) => a + byStatus[s], 0);
  const changed = comp?.memories_changed_7d ?? 0;
  const know = stats ? (stats.knowledge_entities ?? 0) : 0;

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted">State of mind — current beliefs by epistemic status</span>
        <span className="text-[11px] text-muted">
          {changed > 0 && <span className="text-accent-2">{changed} changed · 7d</span>}
          {know > 0 && <span className="ml-3">{know.toLocaleString()} graph entities</span>}
        </span>
      </div>
      {sum === 0 ? (
        <div className="text-xs text-muted/60">No composition data.</div>
      ) : (
        <>
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface-2">
            {ordered.map((s) => (
              <div key={s} className={`${STATUS_DOT[s] ?? "bg-accent"}`} style={{ width: `${(byStatus[s] / sum) * 100}%` }} title={`${s}: ${byStatus[s]}`} />
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {ordered.map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5 text-[11px] text-muted">
                <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[s] ?? "bg-accent"}`} />
                <span className={statusColor(s)}>{s}</span>
                <span className="tabular-nums">{byStatus[s]}</span>
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── List row — shape depends on the active type ──────────────────────────────
function Row({ item, type, meta, selected, onClick }: { item: any; type: TypeKey; meta: TypeMeta; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 hover:bg-surface-2 transition-colors ${selected ? `bg-surface-2 border-l-2 ${meta.ring}` : ""}`}
    >
      {type === "episodic" ? (
        <>
          <p className="text-sm text-foreground line-clamp-2">{(item as Episode).content?.slice(0, 220)}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-[10px] text-muted font-mono">{item.id.slice(0, 16)}</span>
            {(item as Episode).modality && <span className="text-[10px] text-muted bg-surface-2 border border-border rounded px-1.5 py-0.5 font-mono">{(item as Episode).modality}</span>}
            {(item as Episode).source_ref && <span className="text-[10px] text-accent-2 truncate max-w-[40%]">{(item as Episode).source_ref}</span>}
            <span className="text-[10px] text-muted ml-auto">{new Date((item as Episode).ingested_at).toLocaleDateString()}</span>
          </div>
        </>
      ) : type === "identity" ? (
        <>
          <div className="flex items-start justify-between gap-3">
            <span className="text-sm text-foreground flex-1">
              <span className="text-accent-3 font-mono text-xs">{(item as IdentityFact).predicate}</span>
              <span className="text-muted"> — </span>
              {(item as IdentityFact).object}
            </span>
            <span className={`text-[10px] font-mono shrink-0 ${statusColor((item as IdentityFact).epistemic_status)}`}>{(item as IdentityFact).epistemic_status}</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-muted font-mono">conf {(item as IdentityFact).confidence?.toFixed?.(2) ?? (item as IdentityFact).confidence}</span>
            {(item as IdentityFact).valid_to && <span className="text-[10px] text-red-400">SUPERSEDED</span>}
            <span className="text-[10px] text-muted ml-auto">{new Date((item as IdentityFact).valid_from).toLocaleDateString()}</span>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-start justify-between gap-3">
            <span className="text-sm text-foreground flex-1">{(item as Memory).statement?.slice(0, 150)}</span>
            <span className={`text-[10px] font-mono shrink-0 ${statusColor((item as Memory).epistemic_status)}`}>{(item as Memory).epistemic_status}</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            {(item as Memory).kind && (item as Memory).kind !== "fact" && <span className="text-[10px] text-accent-warm font-mono">{(item as Memory).kind}</span>}
            <span className="text-[10px] text-muted font-mono">{item.id.slice(0, 12)}</span>
            {(item as Memory).valid_to && <span className="text-[10px] text-red-400">SUPERSEDED</span>}
            <span className="text-[10px] text-muted ml-auto">{new Date((item as Memory).valid_from).toLocaleDateString()}</span>
          </div>
        </>
      )}
    </button>
  );
}

// ── Memory detail (semantic / procedural) — the rich epistemic view ──────────
function MemoryDetail({ selected, detail, meta, onClose, onInvalidate }: { selected: Memory; detail: any; meta: TypeMeta; onClose: () => void; onInvalidate: (id: string) => void }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4 sticky top-4">
      <div className="flex items-center justify-between mb-3">
        <span className={`text-[10px] font-mono inline-flex items-center gap-1.5 ${meta.text}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />{meta.label}
        </span>
        <button onClick={onClose} className="text-xs text-muted hover:text-foreground">✕</button>
      </div>
      <p className="text-sm text-foreground mb-3">{selected.statement}</p>

      <EpistemicSpectrum status={selected.epistemic_status} />

      <div className="mt-4 text-xs">
        <div className="text-muted/60 mb-1">Valid</div>
        <div className="flex items-center gap-2 text-foreground/90">
          <span>{new Date(selected.valid_from).toLocaleDateString()}</span>
          <span className="text-muted">→</span>
          <span className={selected.valid_to ? "text-red-400" : "text-green-400"}>
            {selected.valid_to ? new Date(selected.valid_to).toLocaleDateString() : "now"}
          </span>
        </div>
      </div>

      {detail && (detail.supersedes || detail.superseded_by) && (
        <div className="mt-4 pt-3 border-t border-border">
          <div className="text-muted/60 text-xs mb-2">Version history</div>
          <div className="space-y-1.5">
            {detail.supersedes && <VersionRow label="replaced" tone="past" text={detail.supersedes.statement} />}
            <VersionRow label="this" tone="current" text={selected.statement} />
            {detail.superseded_by && <VersionRow label="superseded by" tone="future" text={detail.superseded_by.statement} />}
          </div>
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-border space-y-1.5 text-xs text-muted">
        <div><span className="text-muted/60">ID:</span> <span className="font-mono">{selected.id}</span></div>
        <div><span className="text-muted/60">Kind:</span> {selected.kind}{selected.tier ? ` · ${selected.tier}` : ""}</div>
        {detail?.source_episode && (
          <div className="mt-2 pt-2 border-t border-border">
            <div className="text-muted/60 mb-1">Source episode</div>
            <div className="font-mono text-[10px]">{detail.source_episode.id?.slice(0, 20)}</div>
            <div className="mt-1 text-foreground/80">{detail.source_episode.content?.slice(0, 200)}</div>
          </div>
        )}
        {!detail && <div className="text-muted/50">Loading details…</div>}
      </div>

      {!selected.valid_to && (
        <button onClick={() => onInvalidate(selected.id)}
          className="mt-4 w-full rounded border border-red-800/50 bg-red-900/20 px-3 py-1.5 text-xs text-red-400 hover:bg-red-900/40">
          Invalidate
        </button>
      )}
    </div>
  );
}

// ── Episode detail (episodic) — content + the facts it grounded ──────────────
function EpisodeDetail({ selected, detail, onClose }: { selected: Episode; detail: any; onClose: () => void }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4 sticky top-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-mono inline-flex items-center gap-1.5 text-accent-2">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-2" />Episodic
        </span>
        <button onClick={onClose} className="text-xs text-muted hover:text-foreground">✕</button>
      </div>
      <p className="text-sm text-foreground mb-4 whitespace-pre-wrap">{selected.content}</p>
      <div className="space-y-1.5 text-xs text-muted">
        <div><span className="text-muted/60">ID:</span> <span className="font-mono">{selected.id}</span></div>
        {selected.modality && <div><span className="text-muted/60">Modality:</span> {selected.modality}</div>}
        {selected.source_ref && <div><span className="text-muted/60">Source:</span> {selected.source_ref}</div>}
        <div><span className="text-muted/60">Ingested:</span> {new Date(selected.ingested_at).toLocaleString()}</div>
      </div>
      {detail?.memories?.length > 0 && (
        <div className="border-t border-border pt-3 mt-3">
          <div className="text-xs text-muted mb-2">Grounded {detail.memories.length} {detail.memories.length === 1 ? "fact" : "facts"}:</div>
          {detail.memories.map((m: any) => (
            <div key={m.id} className="text-xs text-foreground/80 mb-2 pl-2 border-l border-accent/30">
              <p className="mb-0.5">{m.statement?.slice(0, 120)}</p>
              <div className="flex items-center gap-2 flex-wrap">
                {m.epistemic_status && <span className={`font-mono text-[10px] ${statusColor(m.epistemic_status)}`}>{m.epistemic_status}</span>}
                {m.valid_to && <span className="text-[10px] font-semibold text-red-400 tracking-wide">SUPERSEDED</span>}
              </div>
            </div>
          ))}
        </div>
      )}
      {detail && !(detail.memories?.length > 0) && <div className="border-t border-border pt-3 mt-3 text-xs text-muted/60">No facts grounded on this episode yet.</div>}
    </div>
  );
}

// ── Identity detail (self-model) ─────────────────────────────────────────────
function IdentityDetail({ fact, onClose }: { fact: IdentityFact; onClose: () => void }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4 sticky top-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-mono inline-flex items-center gap-1.5 text-accent-3">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-3" />Identity
        </span>
        <button onClick={onClose} className="text-xs text-muted hover:text-foreground">✕</button>
      </div>
      <div className="text-xs text-accent-3 font-mono mb-1">{fact.predicate}</div>
      <p className="text-sm text-foreground mb-3">{fact.object}</p>
      <EpistemicSpectrum status={fact.epistemic_status} />
      <div className="mt-4 space-y-1.5 text-xs text-muted">
        <div><span className="text-muted/60">Confidence:</span> {fact.confidence?.toFixed?.(2) ?? fact.confidence}</div>
        <div className="flex items-center gap-2">
          <span className="text-muted/60">Valid:</span>
          <span>{new Date(fact.valid_from).toLocaleDateString()}</span>
          <span className="text-muted">→</span>
          <span className={fact.valid_to ? "text-red-400" : "text-green-400"}>{fact.valid_to ? new Date(fact.valid_to).toLocaleDateString() : "now"}</span>
        </div>
        <div><span className="text-muted/60">ID:</span> <span className="font-mono">{fact.id}</span></div>
      </div>
    </div>
  );
}

function EpistemicSpectrum({ status }: { status: string }) {
  const activeIdx = SPECTRUM.indexOf(status);
  return (
    <div>
      <div className="flex gap-1">
        {SPECTRUM.map((s, i) => {
          const active = i === activeIdx;
          const reached = activeIdx >= 0 && i <= activeIdx;
          return (
            <div key={s} className="flex-1" title={s}>
              <div className={`h-1.5 rounded-full ${reached ? STATUS_DOT[status] ?? "bg-accent" : "bg-surface-2"} ${active ? "" : reached ? "opacity-50" : ""}`} />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[9px] text-muted/60">
        <span>seed</span>
        <span className={activeIdx >= 0 ? statusColor(status) : ""}>{status}</span>
        <span>canonical</span>
      </div>
    </div>
  );
}

function VersionRow({ label, tone, text }: { label: string; tone: "past" | "current" | "future"; text: string }) {
  const cls = tone === "current" ? "border-accent/40 bg-surface-2 text-foreground" : "border-border bg-surface text-foreground/60";
  return (
    <div className={`rounded border px-2 py-1.5 ${cls}`}>
      <div className="text-[9px] uppercase tracking-wide text-muted/60">{label}</div>
      <div className="text-[11px] leading-snug">{text?.slice(0, 120)}</div>
    </div>
  );
}
