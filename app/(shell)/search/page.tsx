"use client";

import { useEffect, useState, useMemo } from "react";

const API = "";

interface SearchResult {
  id: string;
  statement: string;
  kind: string;
  score: number;
  valid_from: string;
  valid_to: string | null;
  source_episode_id?: string;
  epistemic_status: string;
}

const EPISTEMIC_COLOR: Record<string, string> = {
  canonical: "text-green-400",
  belief: "text-blue-400",
  hypothesis: "text-yellow-400",
  seed: "text-orange-400",
};

function statusColor(s: string) {
  return EPISTEMIC_COLOR[s] ?? "text-muted";
}

/** Splits `text` around case-insensitive matches of any query word.
 *  Returns an array of { part, highlight } segments — safe, no innerHTML. */
function highlightSegments(
  text: string,
  query: string
): { part: string; highlight: boolean }[] {
  const words = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!words.length) return [{ part: text, highlight: false }];
  const pattern = new RegExp(`(${words.join("|")})`, "gi");
  const segments: { part: string; highlight: boolean }[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      segments.push({ part: text.slice(last, match.index), highlight: false });
    }
    segments.push({ part: match[0], highlight: true });
    last = match.index + match[0].length;
  }
  if (last < text.length) segments.push({ part: text.slice(last), highlight: false });
  return segments;
}

function HighlightedStatement({ text, query }: { text: string; query: string }) {
  const segments = useMemo(() => highlightSegments(text, query), [text, query]);
  return (
    <span>
      {segments.map((seg, i) =>
        seg.highlight ? (
          <mark
            key={i}
            className="bg-accent/20 text-foreground rounded px-0.5 not-italic"
            style={{ background: undefined }}
          >
            {seg.part}
          </mark>
        ) : (
          <span key={i}>{seg.part}</span>
        )
      )}
    </span>
  );
}

function FilterChip({
  label,
  active,
  colorClass,
  onClick,
}: {
  label: string;
  active: boolean;
  colorClass?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors ${
        active
          ? "border-accent bg-accent/10 text-foreground"
          : "border-border bg-surface text-muted hover:border-accent/60"
      } ${colorClass ?? ""}`}
    >
      {label}
    </button>
  );
}

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [rawResults, setRawResults] = useState<SearchResult[]>([]);
  const [rawTotal, setRawTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // Client-side filter state — sets of active values (empty = show all)
  const [activeStatuses, setActiveStatuses] = useState<Set<string>>(new Set());
  const [activeKinds, setActiveKinds] = useState<Set<string>>(new Set());

  // Fetch whenever query changes; reset filters on new search.
  useEffect(() => {
    if (!q.trim()) {
      setRawResults([]);
      setRawTotal(0);
      setActiveStatuses(new Set());
      setActiveKinds(new Set());
      return;
    }
    setLoading(true);
    const params = new URLSearchParams({ q, limit: "30" });
    fetch(`${API}/api/search?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setRawResults(d.items || []);
        setRawTotal(d.count || 0);
        setActiveStatuses(new Set());
        setActiveKinds(new Set());
        setLoading(false);
      });
  }, [q]);

  // Derive distinct values from full result set for chips.
  const availableStatuses = useMemo(
    () =>
      Array.from(new Set(rawResults.map((r) => r.epistemic_status).filter(Boolean))).sort(),
    [rawResults]
  );
  const availableKinds = useMemo(
    () => Array.from(new Set(rawResults.map((r) => r.kind).filter(Boolean))).sort(),
    [rawResults]
  );

  // Apply client-side filters.
  const results = useMemo(() => {
    let items = rawResults;
    if (activeStatuses.size > 0)
      items = items.filter((r) => activeStatuses.has(r.epistemic_status));
    if (activeKinds.size > 0) items = items.filter((r) => activeKinds.has(r.kind));
    return items;
  }, [rawResults, activeStatuses, activeKinds]);

  function toggleStatus(s: string) {
    setActiveStatuses((prev) => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });
  }

  function toggleKind(k: string) {
    setActiveKinds((prev) => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });
  }

  const hasFilters = activeStatuses.size > 0 || activeKinds.size > 0;
  const showChips = rawResults.length > 0 && (availableStatuses.length > 1 || availableKinds.length > 1);

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8">
      <h1 className="text-2xl font-bold text-foreground mb-1">Search</h1>
      <p className="text-sm text-muted mb-6">Full-text search across all memories</p>

      <div className="flex gap-3 mb-4">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search memories, facts, knowledge..."
          className="flex-1 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent"
          autoFocus
        />
      </div>

      {/* Client-side filter chips — only shown when results have multiple distinct values */}
      {showChips && (
        <div className="flex flex-wrap gap-2 mb-4 items-center">
          {availableStatuses.length > 1 && (
            <>
              <span className="text-[10px] text-muted mr-1">Status:</span>
              {availableStatuses.map((s) => (
                <FilterChip
                  key={s}
                  label={s}
                  active={activeStatuses.has(s)}
                  colorClass={activeStatuses.has(s) ? statusColor(s) : undefined}
                  onClick={() => toggleStatus(s)}
                />
              ))}
            </>
          )}
          {availableStatuses.length > 1 && availableKinds.length > 1 && (
            <span className="text-border mx-1">|</span>
          )}
          {availableKinds.length > 1 && (
            <>
              <span className="text-[10px] text-muted mr-1">Kind:</span>
              {availableKinds.map((k) => (
                <FilterChip
                  key={k}
                  label={k}
                  active={activeKinds.has(k)}
                  onClick={() => toggleKind(k)}
                />
              ))}
            </>
          )}
          {hasFilters && (
            <button
              onClick={() => {
                setActiveStatuses(new Set());
                setActiveKinds(new Set());
              }}
              className="text-[10px] text-muted hover:text-foreground ml-1"
            >
              ✕ clear filters
            </button>
          )}
        </div>
      )}

      {loading && <div className="text-sm text-muted">Searching...</div>}

      {!loading && q && (
        <div className="text-sm text-muted mb-4">
          {hasFilters ? (
            <>
              {results.length} of {rawTotal} results for &ldquo;{q}&rdquo;
            </>
          ) : (
            <>
              {rawTotal} results for &ldquo;{q}&rdquo;
            </>
          )}
        </div>
      )}

      <div className="space-y-2">
        {results.map((r) => (
          <div key={r.id} className="rounded-lg border border-border bg-surface px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm text-foreground flex-1">
                <HighlightedStatement text={r.statement} query={q} />
              </p>
              <span className={`text-[10px] font-mono shrink-0 ${statusColor(r.epistemic_status)}`}>
                {r.epistemic_status}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-[10px] text-muted font-mono">{r.id.slice(0, 16)}</span>
              <span className="text-[10px] text-muted">{r.kind}</span>
              <span className="text-[10px] text-muted">score: {r.score?.toFixed(4) ?? "N/A"}</span>
              {r.valid_to && <span className="text-[10px] text-red-400">invalidated</span>}
            </div>
          </div>
        ))}
      </div>

      {!loading && q && results.length === 0 && (
        <div className="text-sm text-muted text-center py-12">No results found.</div>
      )}
    </div>
  );
}
