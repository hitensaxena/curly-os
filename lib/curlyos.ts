// Tiny typed client for the CurlyOS backend, reachable via the /api/* proxy.
// Server-and-client safe — relative URLs only, no node imports.
import type {
  CreateDecisionBody,
  CreateGoalBody,
  Decision,
  EngineTriggerResult,
  EventItem,
  Goal,
  GoalDetail,
  GoalPatch,
  HealthStatus,
  LogResponse,
  LogSource,
  Stats,
  SystemsStatus,
} from "@/lib/curlyos-types";

async function getJSON<T>(path: string): Promise<T> {
  const r = await fetch(path);
  return r.json() as Promise<T>;
}

export function getSystems(): Promise<SystemsStatus> {
  return getJSON<SystemsStatus>("/api/systems");
}

export function getHealth(): Promise<HealthStatus> {
  return getJSON<HealthStatus>("/api/health");
}

export function getStats(): Promise<Stats> {
  return getJSON<Stats>("/api/stats");
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
  });
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
): Promise<Decision> {
  const r = await fetch(
    `/api/decisions/${encodeURIComponent(id)}/review`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcome }),
    },
  );
  return r.json() as Promise<Decision>;
}
