"use client";

// One record, with the provenance you need to trust it: where it came from,
// when it entered memory, its epistemic status, and what superseded it.
// Episode ids resolve to the source transcript instead.

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

const API = "";

type Detail = {
  memory?: {
    id: string;
    statement: string;
    kind: string;
    tier: string;
    epistemic_status: string;
    valid_from: string;
    valid_to: string | null;
    source_episode_id: string;
  };
  source_episode?: { id: string; content: string; source_ref: string; created_at: string } | null;
  superseded_by?: string | null;
  supersedes?: string | null;
  episode?: { id: string; content: string; source_ref: string; created_at: string };
  memories?: { id: string; statement: string; epistemic_status: string }[];
};

export default function RecordPage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(String(params?.id ?? ""));
  const [data, setData] = useState<Detail | null>(null);
  const [kind, setKind] = useState<"memory" | "episode" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mem = await fetch(`${API}/api/memories/${encodeURIComponent(id)}`, {
          signal: AbortSignal.timeout(20_000),
        });
        if (mem.ok) {
          const d = (await mem.json()) as Detail;
          if (!cancelled) {
            setData(d);
            setKind("memory");
          }
          return;
        }
        const epi = await fetch(`${API}/api/episodes/${encodeURIComponent(id)}`, {
          signal: AbortSignal.timeout(20_000),
        });
        if (!epi.ok) throw new Error(`not found (${epi.status})`);
        const d = (await epi.json()) as Detail;
        if (!cancelled) {
          setData(d);
          setKind("episode");
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error)
    return (
      <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
        <p className="text-sm text-foreground">Could not load that record</p>
        <p className="mt-1 font-mono text-xs text-muted">{error}</p>
        <Link href="/library" className="mt-4 inline-block text-sm text-accent hover:underline">
          ← back to library
        </Link>
      </div>
    );

  if (!data)
    return <div className="mx-auto max-w-3xl px-5 py-10 text-sm text-muted sm:px-8">Loading…</div>;

  if (kind === "episode") {
    const epi = data.episode!;
    return (
      <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8">
        <Link href="/library" className="text-xs text-muted hover:text-foreground">
          ← library
        </Link>
        <h1 className="mt-2 text-lg font-semibold text-foreground">Episode</h1>
        <p className="mt-1 font-mono text-xs text-muted">
          {epi.source_ref} · {new Date(epi.created_at).toLocaleString()}
        </p>
        <pre className="mt-4 max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-surface p-4 text-xs leading-relaxed text-foreground">
          {epi.content}
        </pre>
        {data.memories && data.memories.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-2 text-xs uppercase tracking-wide text-muted">
              Facts from this episode
            </h2>
            <ul className="space-y-1">
              {data.memories.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/library/${encodeURIComponent(m.id)}`}
                    className="block rounded border border-border bg-surface px-3 py-2 text-sm text-foreground hover:border-accent/60"
                  >
                    {m.statement}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    );
  }

  const mem = data.memory!;
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8">
      <Link href="/library" className="text-xs text-muted hover:text-foreground">
        ← library
      </Link>

      <h1 className="mt-2 text-lg font-medium leading-relaxed text-foreground">{mem.statement}</h1>

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-4">
        {[
          ["status", mem.epistemic_status],
          ["kind", mem.kind],
          ["tier", mem.tier],
          ["since", new Date(mem.valid_from).toLocaleDateString()],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="uppercase tracking-wide text-muted">{k}</dt>
            <dd className="mt-0.5 text-foreground">{String(v)}</dd>
          </div>
        ))}
      </dl>

      {mem.valid_to && (
        <p className="mt-3 rounded border border-border bg-surface px-3 py-2 text-xs text-muted">
          Superseded on {new Date(mem.valid_to).toLocaleString()}. Kept for history.
        </p>
      )}

      {data.source_episode && (
        <section className="mt-6">
          <h2 className="mb-2 text-xs uppercase tracking-wide text-muted">Where it came from</h2>
          <Link
            href={`/library/${encodeURIComponent(data.source_episode.id)}`}
            className="block rounded-lg border border-border bg-surface px-4 py-3 hover:border-accent/60"
          >
            <p className="font-mono text-[11px] text-muted">{data.source_episode.source_ref}</p>
            <p className="mt-1 line-clamp-4 text-sm leading-relaxed text-foreground">
              {data.source_episode.content}
            </p>
          </Link>
        </section>
      )}

      <p className="mt-6 font-mono text-[10px] text-muted/70">{mem.id}</p>
    </div>
  );
}
