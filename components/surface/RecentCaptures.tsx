"use client";

import { useEffect, useState } from "react";
import { relTime } from "@/lib/format";

interface Episode {
  id: string;
  content: string;
  source_ref: string | null;
  ingested_at: string;
}

export default function RecentCaptures() {
  const [items, setItems] = useState<Episode[]>([]);

  useEffect(() => {
    fetch("/api/episodes?limit=6")
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((d) => setItems(d.items || []))
      .catch(() => {});
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="mt-8 flex flex-col items-center gap-2 w-full max-w-sm px-4">
      <p className="text-[10px] uppercase tracking-[0.25em] text-muted/50 mb-1">recently</p>
      {items.map((ep) => (
        <div key={ep.id} className="flex items-baseline gap-2 w-full justify-center">
          <span className="text-xs text-muted/60 leading-snug text-center truncate max-w-[16rem]">
            {ep.content.length > 70 ? ep.content.slice(0, 70) + "…" : ep.content}
          </span>
          <span className="shrink-0 text-[10px] text-muted/35 font-mono">
            {relTime(new Date(ep.ingested_at).getTime())}
          </span>
        </div>
      ))}
    </div>
  );
}
