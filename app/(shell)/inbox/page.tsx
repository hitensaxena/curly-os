"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeading } from "@/components/ui/PageHeading";
import { useEventStream } from "@/lib/use-event-stream";
import { getInbox, markInboxRead } from "@/lib/curlyos";
import type { InboxItem, SseEvent } from "@/lib/curlyos-types";

function StatusChip({ status }: { status?: string }) {
  if (!status) return null;
  const base = "inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-mono";
  const map: Record<string, string> = {
    completed: "text-green-400 bg-green-400/10 border-green-400/30",
    parked: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
    failed: "text-red-400 bg-red-400/10 border-red-400/30",
    timeout: "text-orange-400 bg-orange-400/10 border-orange-400/30",
    cancelled: "text-muted bg-surface-2 border-border",
  };
  const label = status === "parked" ? "needs approval" : status;
  return <span className={`${base} ${map[status] ?? map.cancelled}`}>{label}</span>;
}

export default function InboxPage() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [jobFilter, setJobFilter] = useState<string | null>(null);

  // Read ?job= from the URL once on mount (client-only — avoids a Suspense
  // boundary for useSearchParams in this fully-client page).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setJobFilter(params.get("job"));
  }, []);

  const load = (job: string | null) => {
    getInbox(job ? { job } : {})
      .then((d) => {
        setItems(d.items);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(jobFilter); }, [jobFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live: a completed/failed run usually drops a fresh inbox item a beat later.
  useEventStream(["agent"], (evt: SseEvent) => {
    if (evt.type.startsWith("agent.run.") &&
        (evt.type.endsWith("completed") || evt.type.endsWith("failed"))) {
      setTimeout(() => load(jobFilter), 1500);
    }
  });

  const open = async (item: InboxItem) => {
    const next = openId === item.id ? null : item.id;
    setOpenId(next);
    if (next && !item.read) {
      try {
        await markInboxRead(item.id);
        setItems((prev) =>
          prev.map((it) => (it.id === item.id ? { ...it, read: true } : it)),
        );
        window.dispatchEvent(new Event("curly-inbox-changed"));
      } catch {
        /* non-fatal */
      }
    }
  };

  const markAllRead = async () => {
    const unread = items.filter((i) => !i.read);
    await Promise.all(unread.map((i) => markInboxRead(i.id).catch(() => {})));
    setItems((prev) => prev.map((it) => ({ ...it, read: true })));
    window.dispatchEvent(new Event("curly-inbox-changed"));
  };

  const unreadCount = items.filter((i) => !i.read).length;
  const filterName = jobFilter ? items.find((i) => i.job_id === jobFilter)?.job_name : null;

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8">
      <PageHeading
        title="Inbox"
        eyebrow="Autonomous OS"
        subtitle={
          loading
            ? "Loading..."
            : `${items.length} item${items.length !== 1 ? "s" : ""}${
                unreadCount > 0 ? ` · ${unreadCount} unread` : ""
              }`
        }
        actions={
          unreadCount > 0 ? (
            <button
              onClick={markAllRead}
              className="rounded border border-border px-3 py-2 text-sm text-muted hover:text-foreground"
            >
              Mark all read
            </button>
          ) : undefined
        }
      />

      {jobFilter ? (
        <div className="mb-5 flex items-center gap-2 text-xs">
          <span className="rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-accent">
            Filtered to {filterName ?? "job"}
          </span>
          <Link href="/inbox" onClick={() => setJobFilter(null)} className="text-muted hover:text-foreground">
            show all
          </Link>
        </div>
      ) : (
        <p className="mb-5 text-xs text-muted">
          Output delivered by your scheduled{" "}
          <Link href="/jobs" className="text-accent hover:underline">jobs</Link>.
        </p>
      )}

      {loading && (
        <div className="flex h-40 items-center justify-center text-sm text-muted">Loading...</div>
      )}

      {!loading && items.length === 0 && (
        <div className="rounded-lg border border-border bg-surface p-8 text-center">
          <div className="mb-3 text-4xl">&#9993;</div>
          <h2 className="mb-1 text-base font-semibold text-foreground">
            {jobFilter ? "No results from this job yet" : "Inbox is empty"}
          </h2>
          <p className="mx-auto max-w-sm text-sm text-muted">
            When a scheduled job runs, its result lands here. Create one on the{" "}
            <Link href="/jobs" className="text-accent hover:underline">Jobs</Link> page.
          </p>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="space-y-2">
          {items.map((item) => {
            const isOpen = openId === item.id;
            const status = item.meta?.status;
            return (
              <div
                key={item.id}
                className={`rounded-lg border bg-surface transition-colors ${
                  item.read ? "border-border" : "border-accent/40"
                }`}
              >
                <button
                  onClick={() => open(item)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface-2/40"
                >
                  {!item.read && (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p
                        className={`min-w-0 flex-1 truncate text-sm ${
                          item.read ? "text-foreground" : "font-semibold text-foreground"
                        }`}
                      >
                        {item.title}
                      </p>
                      <StatusChip status={status} />
                    </div>
                    {!isOpen && (
                      <p className="mt-0.5 truncate text-xs text-muted">{item.body}</p>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-mono text-muted">
                      <span>
                        {item.created_at ? new Date(item.created_at).toLocaleString() : ""}
                      </span>
                      {item.job_name && (
                        <Link
                          href={`/inbox?job=${item.job_id}`}
                          onClick={(e) => { e.stopPropagation(); setJobFilter(item.job_id); }}
                          className="text-muted hover:text-accent"
                        >
                          · {item.job_name}
                        </Link>
                      )}
                    </div>
                  </div>
                  <span className="mt-0.5 shrink-0 text-xs text-muted">
                    {isOpen ? "⌄" : "‹"}
                  </span>
                </button>
                {isOpen && (
                  <div className="border-t border-border px-4 py-3">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                      {item.body}
                    </p>
                    {item.run_id && (
                      <Link
                        href={`/runs/${item.run_id}`}
                        className="mt-3 inline-block text-xs text-accent hover:underline"
                      >
                        view full run trace &#8250;
                      </Link>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
