"use client";

// Library: everything you hold, in one place. Four facets over the same list —
// facts, identity, entities, episodes — plus a graph view for the entity facet.
// Filters are visible; nothing is hidden behind a route.

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

const API = "";
const PAGE = 50;

type Facet = "facts" | "identity" | "entities" | "episodes";

type Row = {
  id: string;
  title: string;
  meta: string;
  status?: string;
  href?: string;
};

const FACETS: { id: Facet; label: string }[] = [
  { id: "facts", label: "Facts" },
  { id: "identity", label: "Identity" },
  { id: "entities", label: "Entities" },
  { id: "episodes", label: "Episodes" },
];

const STATUSES = ["", "canonical", "belief", "hypothesis", "conjecture"];

function statusTone(status?: string): string {
  if (status === "canonical") return "text-accent";
  if (status === "belief") return "text-yellow-400";
  return "text-muted";
}

export default function LibraryPage() {
  const params = useSearchParams();
  const initialFacet = (params.get("facet") as Facet | null) ?? "facts";
  const [facet, setFacet] = useState<Facet>(
    ["facts", "identity", "entities", "episodes"].includes(initialFacet) ? initialFacet : "facts",
  );
  const [q, setQ] = useState(params.get("q") ?? "");
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [view, setView] = useState<"list" | "graph">("list");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const get = async (path: string) => {
        const r = await fetch(`${API}${path}`, { signal: AbortSignal.timeout(30_000) });
        if (!r.ok) throw new Error(`${path} → ${r.status}`);
        return r.json();
      };

      if (facet === "facts") {
        const sp = new URLSearchParams({
          limit: String(PAGE),
          offset: String(page * PAGE),
        });
        if (q.trim()) sp.set("q", q.trim());
        if (status) sp.set("epistemic_status", status);
        const d = await get(`/api/memories?${sp}`);
        setRows(
          (d.items ?? []).map((m: any) => ({
            id: m.id,
            title: m.statement,
            meta: [m.kind, m.epistemic_status, (m.valid_from ?? "").slice(0, 10)]
              .filter(Boolean)
              .join(" · "),
            status: m.epistemic_status,
            href: `/library/${encodeURIComponent(m.id)}`,
          })),
        );
        setTotal(null);
      } else if (facet === "identity") {
        const d = await get(`/api/identity?scope=user:usr_hiten`);
        const items = (d.items ?? []) as any[];
        const filtered = q.trim()
          ? items.filter((i) =>
              `${i.predicate} ${i.object}`.toLowerCase().includes(q.trim().toLowerCase()),
            )
          : items;
        setRows(
          filtered.map((i) => ({
            id: i.id,
            title: `${i.predicate}: ${i.object}`,
            meta: [i.epistemic_status, i.confidence != null ? `conf ${Number(i.confidence).toFixed(2)}` : ""]
              .filter(Boolean)
              .join(" · "),
            status: i.epistemic_status,
          })),
        );
        setTotal(items.length);
      } else if (facet === "entities") {
        const d = await get(`/api/graph?limit=20000`);
        const nodes = (d.nodes ?? []) as any[];
        const filtered = q.trim()
          ? nodes.filter((n) => String(n.name ?? "").toLowerCase().includes(q.trim().toLowerCase()))
          : nodes;
        setRows(
          filtered.slice(page * PAGE, page * PAGE + PAGE).map((n) => ({
            id: n.id,
            title: String(n.name ?? n.id),
            meta: [n.label, n.degree != null ? `${n.degree} links` : ""].filter(Boolean).join(" · "),
            status: n.epistemic_status,
          })),
        );
        setTotal(filtered.length);
      } else {
        const d = await get(`/api/episodes?limit=${PAGE}&offset=${page * PAGE}`);
        setRows(
          (d.items ?? []).map((e: any) => ({
            id: e.id,
            title: String(e.source_ref ?? e.id),
            meta: [
              e.modality,
              (e.created_at ?? "").slice(0, 10),
              `${String(e.content ?? "").length} chars`,
            ]
              .filter(Boolean)
              .join(" · "),
            href: `/library/episode/${encodeURIComponent(e.id)}`,
          })),
        );
        setTotal(typeof d.total === "number" ? d.total : null);
      }
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [facet, q, status, page]);

  useEffect(() => {
    load();
  }, [load]);

  const pages = useMemo(() => (total == null ? null : Math.max(1, Math.ceil(total / PAGE))), [total]);

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold text-foreground">Library</h1>
        <p className="text-xs text-muted">
          {total == null ? (loading ? "loading…" : `${rows.length} shown`) : `${total} total`}
        </p>
      </div>
      <p className="mb-5 text-sm text-muted">Everything CurlyOS holds, filterable. Click a row for provenance.</p>

      {/* Facets + filters, one row */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded border border-border">
          {FACETS.map((f) => (
            <button
              key={f.id}
              onClick={() => {
                setFacet(f.id);
                setPage(0);
              }}
              className={`px-3 py-1.5 text-xs transition-colors ${
                facet === f.id ? "bg-surface text-foreground" : "text-muted hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(0);
          }}
          placeholder="Filter this list…"
          aria-label="Filter this list"
          className="min-w-[12rem] flex-1 rounded border border-border bg-surface px-3 py-1.5 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
        />

        {facet === "facts" && (
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(0);
            }}
            aria-label="Filter by status"
            className="rounded border border-border bg-surface px-2 py-1.5 text-xs text-foreground focus:border-accent focus:outline-none"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s || "any status"}
              </option>
            ))}
          </select>
        )}

        {facet === "entities" && (
          <button
            onClick={() => setView(view === "list" ? "graph" : "list")}
            className="rounded border border-border px-3 py-1.5 text-xs text-muted hover:border-accent hover:text-foreground"
          >
            {view === "list" ? "graph view" : "list view"}
          </button>
        )}
      </div>

      {error && (
        <p className="mb-4 rounded border border-red-400/30 bg-red-400/5 px-3 py-2 text-xs text-red-400">
          {error}
        </p>
      )}

      {facet === "entities" && view === "graph" ? (
        <div className="rounded border border-border bg-surface">
          <iframe
            src="/graph?embed=1"
            title="Knowledge graph"
            className="h-[70vh] w-full rounded"
          />
        </div>
      ) : (
        <>
          <div className="divide-y divide-border rounded-lg border border-border bg-surface">
            {rows.map((row) => {
              const body = (
                <div className="flex items-start justify-between gap-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-foreground">{row.title}</p>
                    <p className="mt-0.5 truncate text-[10px] text-muted">{row.meta}</p>
                  </div>
                  {row.status && (
                    <span className={`shrink-0 text-[10px] ${statusTone(row.status)}`}>{row.status}</span>
                  )}
                </div>
              );
              return row.href ? (
                <Link key={row.id} href={row.href} className="block px-4 transition-colors hover:bg-surface-2">
                  {body}
                </Link>
              ) : (
                <div key={row.id} className="px-4">
                  {body}
                </div>
              );
            })}
            {!loading && rows.length === 0 && (
              <p className="px-4 py-6 text-sm text-muted">Nothing matches that filter.</p>
            )}
            {loading && <p className="px-4 py-6 text-sm text-muted">Loading…</p>}
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-muted">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded border border-border px-3 py-1 disabled:opacity-40"
            >
              ← previous
            </button>
            <span>
              page {page + 1}
              {pages ? ` of ${pages}` : ""}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={rows.length < PAGE}
              className="rounded border border-border px-3 py-1 disabled:opacity-40"
            >
              next →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
