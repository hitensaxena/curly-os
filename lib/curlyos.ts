// Tiny typed client for the CurlyOS backend, reachable via the /api/* proxy.
// Server-and-client safe — relative URLs only, no node imports.
import type {
  CreateDecisionBody,
  CreateGoalBody,
  Decision,
  DecisionWithCouncil,
  EngineTriggerResult,
  EventItem,
  Goal,
  GoalDetail,
  GoalPatch,
  LogResponse,
  LogSource,
  Opportunity,
  ResolveOpportunityBody,
  ResolveOpportunityResult,
  SystemsStatus,
  SchedulerSnapshot,
  AgentRunsResponse,
  JobTriggerResult,
} from "@/lib/curlyos-types";

// A failed request used to resolve to whatever JSON the proxy returned, so a
// 502 or a 401 surfaced as an empty list or a silently dead button. Callers
// that want to show an error can catch; callers that don't get a real throw
// instead of invented empty data.
async function getJSON<T>(path: string): Promise<T> {
  const r = await fetch(path, { signal: AbortSignal.timeout(30_000) });
  if (!r.ok) {
    let detail = r.statusText;
    try {
      const body = await r.json();
      if (body?.error) detail = String(body.error);
      else if (body?.detail) detail = String(body.detail);
    } catch {
      /* non-JSON error body; keep the status text */
    }
    throw new Error(`${path} → ${r.status} ${detail}`);
  }
  return r.json() as Promise<T>;
}

export function getSystems(): Promise<SystemsStatus> {
  return getJSON<SystemsStatus>("/api/systems");
}

export function getLogSources(): Promise<{ sources: LogSource[] }> {
  return getJSON<{ sources: LogSource[] }>("/api/logs/sources");
}

export function getLogs(source: string, lines = 300): Promise<LogResponse> {
  return getJSON<LogResponse>(
    `/api/logs?source=${encodeURIComponent(source)}&lines=${lines}`,
  );
}

export function getEvents(
  limit = 100,
  offset = 0,
): Promise<{ items: EventItem[]; count: number }> {
  return getJSON<{ items: EventItem[]; count: number }>(
    `/api/events?limit=${limit}&offset=${offset}`,
  );
}

export async function trigger(
  path: string,
  body: Record<string, unknown> = {},
): Promise<EngineTriggerResult> {
  const r = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  if (!r.ok) {
    throw new Error(`${path} → ${r.status} ${r.statusText}`);
  }
  return r.json() as Promise<EngineTriggerResult>;
}

// --- Goal OS -----------------------------------------------------------------

export function getGoals(
  status?: string,
): Promise<{ items: Goal[]; count: number }> {
  const q = status ? `?status=${encodeURIComponent(status)}` : "";
  return getJSON<{ items: Goal[]; count: number }>(`/api/goals${q}`);
}

export function getGoal(id: string): Promise<GoalDetail> {
  return getJSON<GoalDetail>(`/api/goals/${encodeURIComponent(id)}`);
}

export async function createGoal(body: CreateGoalBody): Promise<Goal> {
  const r = await fetch("/api/goals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json() as Promise<Goal>;
}

export async function patchGoal(id: string, patch: GoalPatch): Promise<Goal> {
  const r = await fetch(`/api/goals/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return r.json() as Promise<Goal>;
}

export async function invalidateGoal(
  id: string,
  reason: string,
): Promise<unknown> {
  const r = await fetch(`/api/goals/${encodeURIComponent(id)}/invalidate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  return r.json();
}

// --- Decisions ---------------------------------------------------------------

export function getDecisions(
  dueForReview?: boolean,
): Promise<{ items: Decision[]; count: number }> {
  const q =
    dueForReview !== undefined
      ? `?due_for_review=${dueForReview ? "true" : "false"}`
      : "";
  return getJSON<{ items: Decision[]; count: number }>(`/api/decisions${q}`);
}

export async function createDecision(
  body: CreateDecisionBody,
): Promise<Decision> {
  const r = await fetch("/api/decisions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json() as Promise<Decision>;
}

export async function reviewDecision(
  id: string,
  outcome: string,
): Promise<{ decision_id: string; outcome_id: string; status: string }> {
  const r = await fetch(
    `/api/decisions/${encodeURIComponent(id)}/review`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcome }),
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (!r.ok) throw new Error(`review ${id} → ${r.status}`);
  return r.json() as Promise<{ decision_id: string; outcome_id: string; status: string }>;
}

export function getDecisionsWithCouncil(
  dueForReview?: boolean,
): Promise<{ items: DecisionWithCouncil[]; count: number }> {
  const q =
    dueForReview !== undefined
      ? `?due_for_review=${dueForReview ? "true" : "false"}`
      : "";
  return getJSON<{ items: DecisionWithCouncil[]; count: number }>(`/api/decisions${q}`);
}

// --- Opportunities -----------------------------------------------------------

export function getOpportunities(
  status?: string,
): Promise<{ items: Opportunity[]; count: number }> {
  const q = status ? `?status=${encodeURIComponent(status)}` : "";
  return getJSON<{ items: Opportunity[]; count: number }>(`/api/opportunities${q}`);
}

export async function resolveOpportunity(
  id: string,
  body: ResolveOpportunityBody,
): Promise<ResolveOpportunityResult> {
  const r = await fetch(`/api/opportunities/${encodeURIComponent(id)}/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    const msg = (err as { detail?: string }).detail ?? `HTTP ${r.status}`;
    throw Object.assign(new Error(msg), { status: r.status });
  }
  return r.json() as Promise<ResolveOpportunityResult>;
}

// --- Background jobs ---------------------------------------------------------
export function getScheduler(): Promise<SchedulerSnapshot> {
  return getJSON<SchedulerSnapshot>("/api/scheduler");
}

export function getAgentRuns(
  opts: { limit?: number; offset?: number; job?: string; status?: string } = {},
): Promise<AgentRunsResponse> {
  const q = new URLSearchParams();
  q.set("limit", String(opts.limit ?? 50));
  q.set("offset", String(opts.offset ?? 0));
  // The core filters on the full agent string ("workflow:<job>").
  if (opts.job) q.set("agent", `workflow:${opts.job}`);
  if (opts.status) q.set("status", opts.status);
  return getJSON<AgentRunsResponse>(`/api/agent-runs?${q.toString()}`);
}

export async function runJobNow(name: string): Promise<JobTriggerResult> {
  const r = await fetch(`/api/scheduler/run/${encodeURIComponent(name)}`, { method: "POST" });
  return r.json() as Promise<JobTriggerResult>;
}
