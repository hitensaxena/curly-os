"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PageHeading } from "@/components/ui/PageHeading";
import { JobActivity } from "@/components/jobs/JobActivity";
import { useEventStream } from "@/lib/use-event-stream";
import {
  getScheduledJobs,
  createScheduledJob,
  patchScheduledJob,
  deleteScheduledJob,
  runScheduledJobNow,
} from "@/lib/curlyos";
import type {
  ScheduledJob,
  CadenceType,
  Cadence,
  CreateScheduledJobBody,
  SseEvent,
} from "@/lib/curlyos-types";

// ── cadence editor model ──────────────────────────────────────────────────────

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type CadenceDraft = {
  type: CadenceType;
  everyValue: number; // amount
  everyUnit: "minutes" | "hours";
  hhmm: string;
  weekdays: number[];
  monthDay: number;
};

const EMPTY_DRAFT: CadenceDraft = {
  type: "daily_at",
  everyValue: 1,
  everyUnit: "hours",
  hhmm: "09:00",
  weekdays: [0],
  monthDay: 1,
};

function draftToCadence(d: CadenceDraft): { cadence_type: CadenceType; cadence_json: Cadence } {
  switch (d.type) {
    case "every": {
      const minutes = d.everyUnit === "hours" ? d.everyValue * 60 : d.everyValue;
      return { cadence_type: "every", cadence_json: { minutes } };
    }
    case "daily_at":
      return { cadence_type: "daily_at", cadence_json: { hhmm: d.hhmm } };
    case "weekly_at":
      return { cadence_type: "weekly_at", cadence_json: { weekdays: d.weekdays, hhmm: d.hhmm } };
    case "monthly_at":
      return { cadence_type: "monthly_at", cadence_json: { day: d.monthDay, hhmm: d.hhmm } };
  }
}

// ── status chip ───────────────────────────────────────────────────────────────

function StatusChip({ status }: { status: string }) {
  const base = "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-mono";
  const map: Record<string, string> = {
    never: "text-muted bg-surface-2 border-border",
    running: "text-accent bg-accent/10 border-accent/30",
    completed: "text-green-400 bg-green-400/10 border-green-400/30",
    failed: "text-red-400 bg-red-400/10 border-red-400/30",
    parked: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
    timeout: "text-orange-400 bg-orange-400/10 border-orange-400/30",
  };
  const label = status === "running" ? "running" : status === "parked" ? "needs approval" : status;
  return (
    <span className={`${base} ${map[status] ?? map.never}`}>
      {status === "running" && (
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
      )}
      {label}
    </span>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function JobsPage() {
  const [jobs, setJobs] = useState<ScheduledJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState<string | null>(null); // job id being mutated
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = () => {
    getScheduledJobs()
      .then((d) => {
        setJobs(d.items);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Live: any agent run starting/finishing may change a job's status — refresh
  // the list (debounced so a burst of events collapses into one reload).
  useEventStream(["agent"], (evt: SseEvent) => {
    if (!evt.type.startsWith("agent.run.")) return;
    if (reloadTimer.current) clearTimeout(reloadTimer.current);
    reloadTimer.current = setTimeout(load, 600);
  });

  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggle = async (job: ScheduledJob) => {
    setBusy(job.id);
    try {
      await patchScheduledJob(job.id, { enabled: !job.enabled });
      load();
    } finally {
      setBusy(null);
    }
  };

  const runNow = async (job: ScheduledJob) => {
    setBusy(job.id);
    try {
      await runScheduledJobNow(job.id);
      setExpanded((prev) => new Set(prev).add(job.id)); // show live activity
    } finally {
      setBusy(null);
      // give the run a moment to register its run_id, then refresh
      setTimeout(load, 1200);
    }
  };

  const remove = async (job: ScheduledJob) => {
    if (!confirm(`Delete job "${job.name}"? Past inbox items are kept.`)) return;
    setBusy(job.id);
    try {
      await deleteScheduledJob(job.id);
      load();
    } finally {
      setBusy(null);
    }
  };

  const enabledCount = jobs.filter((j) => j.enabled).length;
  const runningCount = jobs.filter(
    (j) => j.last_status === "running" || j.last_status === "parked",
  ).length;

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8">
      <PageHeading
        title="Jobs"
        eyebrow="Autonomous OS"
        subtitle={
          loading
            ? "Loading..."
            : `${jobs.length} job${jobs.length !== 1 ? "s" : ""}${
                enabledCount > 0 ? ` · ${enabledCount} enabled` : ""
              }${runningCount > 0 ? ` · ${runningCount} running now` : ""}`
        }
        actions={
          <button
            onClick={() => setShowForm((s) => !s)}
            className="rounded bg-accent px-4 py-2 text-sm text-white hover:bg-accent/80"
          >
            {showForm ? "Close" : "New job"}
          </button>
        }
      />

      <p className="mb-5 text-xs text-muted">
        Define a task in plain language and a cadence. At each interval CurlyOS runs it through the
        Executive agent (memory, knowledge graph &amp; tools) and delivers the result to your{" "}
        <Link href="/inbox" className="text-accent hover:underline">Inbox</Link>. A job that needs to
        take a write action will pause for your approval in{" "}
        <Link href="/approvals" className="text-accent hover:underline">Approvals</Link> instead of
        finishing silently.
      </p>

      {showForm && (
        <NewJobForm
          onCreated={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      {loading && (
        <div className="flex h-40 items-center justify-center text-sm text-muted">Loading...</div>
      )}

      {!loading && jobs.length === 0 && !showForm && (
        <div className="rounded-lg border border-border bg-surface p-8 text-center">
          <div className="mb-3 text-4xl">&#9203;</div>
          <h2 className="mb-1 text-base font-semibold text-foreground">No jobs yet</h2>
          <p className="mx-auto max-w-sm text-sm text-muted">
            Create your first autonomous job — e.g. &ldquo;Each morning, find 5 things I could improve
            and explain why.&rdquo;
          </p>
        </div>
      )}

      {!loading && jobs.length > 0 && (
        <div className="space-y-3">
          {jobs.map((job) => {
            const isActive = job.last_status === "running" || job.last_status === "parked";
            const showActivity = (isActive || expanded.has(job.id)) && !!job.last_run_id;
            return (
            <div
              key={job.id}
              className={`rounded-lg border bg-surface p-4 ${
                isActive
                  ? "border-accent/40"
                  : job.enabled
                    ? "border-border"
                    : "border-border opacity-60"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{job.name}</span>
                    <span className="rounded border border-border bg-surface-2 px-1.5 py-0.5 text-[10px] font-mono text-muted">
                      {job.cadence_display}
                    </span>
                    {job.last_status !== "never" && <StatusChip status={job.last_status} />}
                  </div>
                  <p className="mt-1 text-sm text-muted">{job.task}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] font-mono text-muted">
                    {job.next_due && job.enabled && (
                      <span>next {new Date(job.next_due).toLocaleString()}</span>
                    )}
                    {job.last_fired && (
                      <span>last {new Date(job.last_fired).toLocaleString()}</span>
                    )}
                    {job.last_run_id && (
                      <Link href={`/runs/${job.last_run_id}`} className="text-accent hover:underline">
                        view last run &#8250;
                      </Link>
                    )}
                  </div>
                  {job.last_error && (
                    <p className="mt-1 text-xs text-red-400">{job.last_error}</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <button
                    role="switch"
                    aria-checked={job.enabled}
                    disabled={busy === job.id}
                    onClick={() => toggle(job)}
                    className={`relative h-5 w-9 rounded-full transition-colors disabled:opacity-50 ${
                      job.enabled ? "bg-accent" : "bg-surface-2 border border-border"
                    }`}
                    title={job.enabled ? "Enabled — click to pause" : "Paused — click to enable"}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                        job.enabled ? "translate-x-4" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
              </div>
              {/* Live activity — auto-shown while running/parked, toggleable otherwise */}
              {showActivity && job.last_run_id && (
                <div className="mt-3 rounded-md border border-border bg-surface-2/30 p-3">
                  <JobActivity runId={job.last_run_id} onTerminal={() => load()} />
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                <button
                  disabled={busy === job.id || isActive}
                  onClick={() => runNow(job)}
                  className="rounded border border-border px-2.5 py-1 text-xs text-foreground hover:bg-surface-2 disabled:opacity-50"
                  title={isActive ? "A run is already in progress" : "Run this job now"}
                >
                  {isActive ? "Running…" : "Run now"}
                </button>
                {job.last_run_id && !isActive && (
                  <button
                    onClick={() => toggleExpanded(job.id)}
                    className="rounded border border-border px-2.5 py-1 text-xs text-foreground hover:bg-surface-2"
                  >
                    {expanded.has(job.id) ? "Hide activity" : "Activity"}
                  </button>
                )}
                {(job.last_status !== "never") && (
                  <Link
                    href={`/inbox?job=${job.id}`}
                    className="rounded border border-border px-2.5 py-1 text-xs text-foreground hover:bg-surface-2"
                  >
                    Past results
                  </Link>
                )}
                <button
                  disabled={busy === job.id}
                  onClick={() => remove(job)}
                  className="ml-auto rounded border border-border px-2.5 py-1 text-xs text-red-400 hover:bg-red-400/10 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── new job form ──────────────────────────────────────────────────────────────

function NewJobForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [task, setTask] = useState("");
  const [cad, setCad] = useState<CadenceDraft>(EMPTY_DRAFT);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const setType = (type: CadenceType) => setCad((c) => ({ ...c, type }));
  const toggleWeekday = (d: number) =>
    setCad((c) => ({
      ...c,
      weekdays: c.weekdays.includes(d)
        ? c.weekdays.filter((x) => x !== d)
        : [...c.weekdays, d].sort((a, b) => a - b),
    }));

  const submit = async () => {
    setError("");
    if (!name.trim() || !task.trim()) {
      setError("Name and task are both required.");
      return;
    }
    if (cad.type === "weekly_at" && cad.weekdays.length === 0) {
      setError("Pick at least one weekday.");
      return;
    }
    if (cad.type === "every") {
      const minutes = cad.everyUnit === "hours" ? cad.everyValue * 60 : cad.everyValue;
      if (minutes < 5) {
        setError("Minimum interval is 5 minutes.");
        return;
      }
    }
    setSubmitting(true);
    try {
      const body: CreateScheduledJobBody = {
        name: name.trim(),
        task: task.trim(),
        ...draftToCadence(cad),
        enabled: true,
      };
      await createScheduledJob(body);
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create job.");
      setSubmitting(false);
    }
  };

  const tabBtn = (type: CadenceType, label: string) => (
    <button
      key={type}
      type="button"
      onClick={() => setType(type)}
      className={`rounded px-3 py-1.5 text-xs transition-colors ${
        cad.type === type
          ? "bg-accent text-white"
          : "border border-border text-muted hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="mb-6 rounded-lg border border-border bg-surface p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">New job</p>

      <label className="mb-1 block text-xs text-muted">Name</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Morning improvement scan"
        className="mb-3 w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
      />

      <label className="mb-1 block text-xs text-muted">Task (natural language)</label>
      <textarea
        value={task}
        onChange={(e) => setTask(e.target.value)}
        rows={3}
        placeholder="Each morning, look across my memory, knowledge graph and goals and surface 5 concrete things I could improve or expand — with a short reason for each."
        className="mb-3 w-full resize-y rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
      />

      <label className="mb-1 block text-xs text-muted">Interval</label>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {tabBtn("every", "Every")}
        {tabBtn("daily_at", "Daily")}
        {tabBtn("weekly_at", "Weekly")}
        {tabBtn("monthly_at", "Monthly")}
      </div>

      <div className="mb-4 rounded border border-border bg-surface-2/40 p-3">
        {cad.type === "every" && (
          <div className="flex items-center gap-2 text-sm text-foreground">
            <span className="text-muted">Run every</span>
            <input
              type="number"
              min={1}
              value={cad.everyValue}
              onChange={(e) => setCad((c) => ({ ...c, everyValue: Math.max(1, +e.target.value) }))}
              className="w-20 rounded border border-border bg-surface px-2 py-1 text-sm focus:border-accent focus:outline-none"
            />
            <select
              value={cad.everyUnit}
              onChange={(e) =>
                setCad((c) => ({ ...c, everyUnit: e.target.value as "minutes" | "hours" }))
              }
              className="rounded border border-border bg-surface px-2 py-1 text-sm focus:border-accent focus:outline-none"
            >
              <option value="minutes">minutes</option>
              <option value="hours">hours</option>
            </select>
            <span className="text-[10px] text-muted">(min 5 minutes)</span>
          </div>
        )}

        {cad.type === "daily_at" && (
          <div className="flex items-center gap-2 text-sm text-foreground">
            <span className="text-muted">Every day at</span>
            <TimeInput value={cad.hhmm} onChange={(hhmm) => setCad((c) => ({ ...c, hhmm }))} />
          </div>
        )}

        {cad.type === "weekly_at" && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map((d, i) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleWeekday(i)}
                  className={`rounded px-2.5 py-1 text-xs transition-colors ${
                    cad.weekdays.includes(i)
                      ? "bg-accent text-white"
                      : "border border-border text-muted hover:text-foreground"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-sm text-foreground">
              <span className="text-muted">at</span>
              <TimeInput value={cad.hhmm} onChange={(hhmm) => setCad((c) => ({ ...c, hhmm }))} />
            </div>
          </div>
        )}

        {cad.type === "monthly_at" && (
          <div className="flex flex-wrap items-center gap-2 text-sm text-foreground">
            <span className="text-muted">On day</span>
            <input
              type="number"
              min={1}
              max={28}
              value={cad.monthDay}
              onChange={(e) =>
                setCad((c) => ({ ...c, monthDay: Math.min(28, Math.max(1, +e.target.value)) }))
              }
              className="w-16 rounded border border-border bg-surface px-2 py-1 text-sm focus:border-accent focus:outline-none"
            />
            <span className="text-muted">of each month at</span>
            <TimeInput value={cad.hhmm} onChange={(hhmm) => setCad((c) => ({ ...c, hhmm }))} />
            <span className="text-[10px] text-muted">(1–28)</span>
          </div>
        )}
      </div>

      {error && <p className="mb-2 text-xs text-red-400">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          onClick={submit}
          disabled={submitting}
          className="rounded bg-accent px-4 py-2 text-sm text-white hover:bg-accent/80 disabled:opacity-40"
        >
          {submitting ? "Creating..." : "Create job"}
        </button>
      </div>
    </div>
  );
}

function TimeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="time"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded border border-border bg-surface px-2 py-1 text-sm text-foreground focus:border-accent focus:outline-none"
    />
  );
}
