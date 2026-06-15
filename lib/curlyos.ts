// Tiny typed client for the CurlyOS backend, reachable via the /api/* proxy.
// Server-and-client safe — relative URLs only, no node imports.
import type {
  AgentRun,
  AgentRunDetail,
  ApprovalActionResult,
  ActivateResult,
  CouncilResult,
  CreateApprovalResult,
  CreateDecisionBody,
  CreateGoalBody,
  CreateRunBody,
  CreateRunResult,
  Decision,
  DecisionWithCouncil,
  DiscoveryScanResult,
  EngineTriggerResult,
  EvalResult,
  EventItem,
  EvolutionTimelineItem,
  Goal,
  GoalDetail,
  GoalPatch,
  HealthStatus,
  LogResponse,
  LogSource,
  Opportunity,
  PendingApproval,
  ProposePromptBody,
  ProposePromptResult,
  PromptVersion,
  ResolveOpportunityBody,
  ResolveOpportunityResult,
  RunActionResult,
  SimExecuteResult,
  Stats,
  SystemsStatus,
  ScheduledJob,
  CreateScheduledJobBody,
  ScheduledJobPatch,
  InboxItem,
  GoalPlan,
  OrchestratorOverview,
  OrchestratorMessage,
  OrchestratorChatResult,
  DecomposeResult,
  GoalArtifact,
  Workspace,
  WorkspaceDetail,
  ProjectDetail,
  Artifact,
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

export function getDecisionsWithCouncil(
  dueForReview?: boolean,
): Promise<{ items: DecisionWithCouncil[]; count: number }> {
  const q =
    dueForReview !== undefined
      ? `?due_for_review=${dueForReview ? "true" : "false"}`
      : "";
  return getJSON<{ items: DecisionWithCouncil[]; count: number }>(`/api/decisions${q}`);
}

export async function runCouncil(id: string): Promise<CouncilResult> {
  const r = await fetch(`/api/decisions/${encodeURIComponent(id)}/council`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    const msg = (err as { detail?: string }).detail ?? `HTTP ${r.status}`;
    throw Object.assign(new Error(msg), { status: r.status });
  }
  return r.json() as Promise<CouncilResult>;
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

export async function scanDiscovery(): Promise<DiscoveryScanResult> {
  const r = await fetch("/api/discovery/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    const msg = (err as { detail?: string }).detail ?? `HTTP ${r.status}`;
    throw Object.assign(new Error(msg), { status: r.status });
  }
  return r.json() as Promise<DiscoveryScanResult>;
}

// --- Simulation execute -------------------------------------------------------

export async function executeSimRun(id: string): Promise<SimExecuteResult> {
  const r = await fetch(`/api/simulation/runs/${encodeURIComponent(id)}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    const msg = (err as { detail?: string }).detail ?? `HTTP ${r.status}`;
    throw Object.assign(new Error(msg), { status: r.status });
  }
  return r.json() as Promise<SimExecuteResult>;
}

// --- Agent Runs --------------------------------------------------------------

export function getAgentRuns(params?: {
  status?: string;
  agent?: string;
  limit?: number;
}): Promise<{ items: AgentRun[]; count: number }> {
  const q = new URLSearchParams();
  if (params?.status) q.set("status", params.status);
  if (params?.agent) q.set("agent", params.agent);
  if (params?.limit !== undefined) q.set("limit", String(params.limit));
  const qs = q.toString() ? `?${q.toString()}` : "";
  return getJSON<{ items: AgentRun[]; count: number }>(`/api/agents/runs${qs}`);
}

export function getAgentRun(id: string): Promise<AgentRunDetail> {
  return getJSON<AgentRunDetail>(`/api/agents/runs/${encodeURIComponent(id)}`);
}

export async function createAgentRun(body: CreateRunBody): Promise<CreateRunResult> {
  const r = await fetch("/api/agents/runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json() as Promise<CreateRunResult>;
}

export async function resumeAgentRun(id: string): Promise<RunActionResult> {
  const r = await fetch(`/api/agents/runs/${encodeURIComponent(id)}/resume`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  return r.json() as Promise<RunActionResult>;
}

export async function cancelAgentRun(id: string): Promise<RunActionResult> {
  const r = await fetch(`/api/agents/runs/${encodeURIComponent(id)}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  return r.json() as Promise<RunActionResult>;
}

// --- Approvals ---------------------------------------------------------------

export function getPendingApprovals(): Promise<{ items: PendingApproval[]; count: number }> {
  return getJSON<{ items: PendingApproval[]; count: number }>("/api/approvals");
}

export async function grantApproval(id: string): Promise<ApprovalActionResult> {
  const r = await fetch(`/api/approvals/${encodeURIComponent(id)}/grant`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  return r.json() as Promise<ApprovalActionResult>;
}

export async function denyApproval(
  id: string,
  reason: string,
): Promise<ApprovalActionResult> {
  const r = await fetch(`/api/approvals/${encodeURIComponent(id)}/deny`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  return r.json() as Promise<ApprovalActionResult>;
}

// --- Evolution ---------------------------------------------------------------

export function getEvolutionPrompts(): Promise<{
  items: PromptVersion[];
  count: number;
}> {
  return getJSON<{ items: PromptVersion[]; count: number }>(
    "/api/evolution/prompts",
  );
}

export function getEvolutionTimeline(
  limit = 50,
): Promise<{ items: EvolutionTimelineItem[] }> {
  return getJSON<{ items: EvolutionTimelineItem[] }>(
    `/api/evolution/timeline?limit=${limit}`,
  );
}

export async function proposePromptVersion(
  body: ProposePromptBody,
): Promise<ProposePromptResult> {
  const r = await fetch("/api/evolution/prompts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    const msg = (err as { detail?: string }).detail ?? `HTTP ${r.status}`;
    throw Object.assign(new Error(msg), { status: r.status });
  }
  return r.json() as Promise<ProposePromptResult>;
}

export async function evaluatePrompt(id: string): Promise<EvalResult> {
  const r = await fetch(
    `/api/evolution/prompts/${encodeURIComponent(id)}/evaluate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
  );
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    const msg = (err as { detail?: string }).detail ?? `HTTP ${r.status}`;
    throw Object.assign(new Error(msg), { status: r.status });
  }
  return r.json() as Promise<EvalResult>;
}

export async function createSelfModifyApproval(
  pmtId: string,
): Promise<CreateApprovalResult> {
  const r = await fetch("/api/approvals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action_class: "self_modify",
      payload: { pmt_id: pmtId },
    }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    const msg = (err as { detail?: string }).detail ?? `HTTP ${r.status}`;
    throw Object.assign(new Error(msg), { status: r.status });
  }
  return r.json() as Promise<CreateApprovalResult>;
}

export async function activatePrompt(
  id: string,
  approvalId: string,
): Promise<ActivateResult> {
  const r = await fetch(
    `/api/evolution/prompts/${encodeURIComponent(id)}/activate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approval_id: approvalId }),
    },
  );
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    const msg = (err as { detail?: string }).detail ?? `HTTP ${r.status}`;
    throw Object.assign(new Error(msg), { status: r.status, detail: msg });
  }
  return r.json() as Promise<ActivateResult>;
}

// --- Scheduled jobs ----------------------------------------------------------

async function throwIfBad(r: Response): Promise<void> {
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    const msg = (err as { detail?: string }).detail ?? `HTTP ${r.status}`;
    throw Object.assign(new Error(msg), { status: r.status, detail: msg });
  }
}

export function getScheduledJobs(): Promise<{ items: ScheduledJob[]; count: number }> {
  return getJSON<{ items: ScheduledJob[]; count: number }>("/api/scheduled-jobs");
}

export async function createScheduledJob(
  body: CreateScheduledJobBody,
): Promise<ScheduledJob> {
  const r = await fetch("/api/scheduled-jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  await throwIfBad(r);
  return r.json() as Promise<ScheduledJob>;
}

export async function patchScheduledJob(
  id: string,
  patch: ScheduledJobPatch,
): Promise<ScheduledJob> {
  const r = await fetch(`/api/scheduled-jobs/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  await throwIfBad(r);
  return r.json() as Promise<ScheduledJob>;
}

export async function deleteScheduledJob(id: string): Promise<void> {
  const r = await fetch(`/api/scheduled-jobs/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  await throwIfBad(r);
}

export async function runScheduledJobNow(
  id: string,
): Promise<{ id: string; status: string }> {
  const r = await fetch(`/api/scheduled-jobs/${encodeURIComponent(id)}/run-now`, {
    method: "POST",
  });
  await throwIfBad(r);
  return r.json() as Promise<{ id: string; status: string }>;
}

// --- Inbox -------------------------------------------------------------------

export function getInbox(
  opts: { unread?: boolean; job?: string } = {},
): Promise<{ items: InboxItem[]; count: number }> {
  const qs = new URLSearchParams();
  if (opts.unread) qs.set("unread", "true");
  if (opts.job) qs.set("job", opts.job);
  const q = qs.toString();
  return getJSON<{ items: InboxItem[]; count: number }>(`/api/inbox${q ? `?${q}` : ""}`);
}

export function getInboxUnreadCount(): Promise<{ unread: number }> {
  return getJSON<{ unread: number }>("/api/inbox/unread-count");
}

export async function markInboxRead(id: string): Promise<void> {
  const r = await fetch(`/api/inbox/${encodeURIComponent(id)}/read`, {
    method: "POST",
  });
  await throwIfBad(r);
}

// --- Goal-execution orchestrator ---------------------------------------------

export function getOrchestratorOverview(): Promise<OrchestratorOverview> {
  return getJSON<OrchestratorOverview>("/api/orchestrator/overview");
}

export function getGoalPlan(goalId: string): Promise<{ plan: GoalPlan | null }> {
  return getJSON<{ plan: GoalPlan | null }>(
    `/api/goals/${encodeURIComponent(goalId)}/plan`,
  );
}

export async function decomposeGoal(
  goalId: string,
  guidance?: string,
): Promise<DecomposeResult> {
  const r = await fetch(`/api/goals/${encodeURIComponent(goalId)}/decompose`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ guidance: guidance ?? null }),
  });
  await throwIfBad(r);
  return r.json() as Promise<DecomposeResult>;
}

export async function approvePlan(planId: string): Promise<{ status: string }> {
  const r = await fetch(`/api/goal-plans/${encodeURIComponent(planId)}/approve`, {
    method: "POST",
  });
  await throwIfBad(r);
  return r.json() as Promise<{ status: string }>;
}

export async function dispatchTask(
  taskId: string,
): Promise<{ task_id: string; run_id?: string; status?: string }> {
  const r = await fetch(`/api/goal-tasks/${encodeURIComponent(taskId)}/dispatch`, {
    method: "POST",
  });
  await throwIfBad(r);
  return r.json();
}

export async function dispatchPlan(
  planId: string,
): Promise<{ plan_id: string; dispatched: number }> {
  const r = await fetch(
    `/api/goal-plans/${encodeURIComponent(planId)}/dispatch-all`,
    { method: "POST" },
  );
  await throwIfBad(r);
  return r.json();
}

export async function orchestratorChat(
  message: string,
  goalId?: string,
): Promise<OrchestratorChatResult> {
  const r = await fetch("/api/orchestrator/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, goal_id: goalId ?? null }),
  });
  await throwIfBad(r);
  return r.json() as Promise<OrchestratorChatResult>;
}

export function getOrchestratorMessages(
  goalId?: string,
): Promise<{ items: OrchestratorMessage[]; count: number }> {
  const q = goalId ? `?goal_id=${encodeURIComponent(goalId)}` : "";
  return getJSON<{ items: OrchestratorMessage[]; count: number }>(
    `/api/orchestrator/messages${q}`,
  );
}

export async function executePlan(
  planId: string,
): Promise<{ plan_id: string; dispatched: number }> {
  const r = await fetch(`/api/goal-plans/${encodeURIComponent(planId)}/execute`, {
    method: "POST",
  });
  await throwIfBad(r);
  return r.json();
}

export function getGoalArtifacts(
  goalId: string,
): Promise<{ items: GoalArtifact[]; count: number }> {
  return getJSON<{ items: GoalArtifact[]; count: number }>(
    `/api/goals/${encodeURIComponent(goalId)}/artifacts`,
  );
}

// ── Hierarchy: workspace → project → goal/artifacts ───────────────────────────

export function getWorkspaces(): Promise<{ items: Workspace[]; count: number }> {
  return getJSON<{ items: Workspace[]; count: number }>("/api/workspaces");
}

export function getWorkspaceDetail(workspaceId: string): Promise<WorkspaceDetail> {
  return getJSON<WorkspaceDetail>(
    `/api/workspaces/${encodeURIComponent(workspaceId)}`,
  );
}

// Singular `/api/project/{id}` — NOT `/api/projects/` — because the webapp's
// own `/api/projects/[slug]` route (the separate code-registry project concept)
// shadows the core proxy for that path.
export function getProjectDetail(projectId: string): Promise<ProjectDetail> {
  return getJSON<ProjectDetail>(
    `/api/project/${encodeURIComponent(projectId)}`,
  );
}

// Tangible deliverables (new artifacts table), optionally scoped to a goal/project.
export function getArtifacts(
  opts: { projectId?: string; goalId?: string } = {},
): Promise<{ items: Artifact[]; count: number }> {
  const q = new URLSearchParams();
  if (opts.projectId) q.set("project_id", opts.projectId);
  if (opts.goalId) q.set("goal_id", opts.goalId);
  const qs = q.toString();
  return getJSON<{ items: Artifact[]; count: number }>(
    `/api/artifacts${qs ? `?${qs}` : ""}`,
  );
}

export function getAutoPlan(): Promise<{ auto_plan: boolean }> {
  return getJSON<{ auto_plan: boolean }>("/api/settings/auto-plan");
}

export async function setAutoPlan(enabled: boolean): Promise<{ auto_plan: boolean }> {
  const r = await fetch("/api/settings/auto-plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  });
  await throwIfBad(r);
  return r.json() as Promise<{ auto_plan: boolean }>;
}

export async function runAutoplan(): Promise<{ planned: unknown[]; candidates: number }> {
  const r = await fetch("/api/orchestrator/autoplan", { method: "POST" });
  await throwIfBad(r);
  return r.json();
}

export function getAgentBypass(): Promise<{ bypass: boolean }> {
  return getJSON<{ bypass: boolean }>("/api/settings/agent-bypass");
}

export async function setAgentBypass(enabled: boolean): Promise<{ bypass: boolean }> {
  const r = await fetch("/api/settings/agent-bypass", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  });
  await throwIfBad(r);
  return r.json() as Promise<{ bypass: boolean }>;
}
