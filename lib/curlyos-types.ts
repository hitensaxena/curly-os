// TypeScript types for CurlyOS API responses.
export interface HealthStatus {
  timestamp: string;
  postgres: { ok: boolean; version?: string; pgvector?: boolean; error?: string };
  redis: { ok: boolean; version?: string; error?: string };
  embedder: { ok: boolean; model?: string; error?: string };
}

export interface Stats {
  episodes: number;
  memories: number;
  identity_facts: number;
  knowledge_entities: number;
  knowledge_edges: number;
}

export interface Memory {
  id: string;
  scope: string;
  statement: string;
  kind: string;
  tier: string;
  epistemic_status: string;
  valid_from: string;
  valid_to: string | null;
  ingested_at: string;
  source_episode_id: string;
  superseded_by: string | null;
}

export interface Episode {
  id: string;
  scope: string;
  content: string;
  source_ref: string | null;
  modality: string;
  ingested_at: string;
  created_at: string;
}

export interface IdentityFact {
  id: string;
  scope: string;
  predicate: string;
  object: string;
  confidence: number;
  epistemic_status: string;
  valid_from: string;
  valid_to: string | null;
  source_episode_id: string;
  superseded_by: string | null;
}

export interface KnowledgeEntity {
  id: string;
  scope: string;
  name: string;
  label: string;
  properties: Record<string, unknown>;
  epistemic_status: string;
  valid_from: string;
  valid_to: string | null;
  source_episode_id: string | null;
}

export interface KnowledgeEdge {
  id: string;
  src_entity_id: string;
  dst_entity_id: string;
  rel_type: string;
  properties: Record<string, unknown>;
  valid_from: string;
  valid_to: string | null;
  source_episode_id: string | null;
}

export interface GraphNode {
  id: string;
  name: string;
  label: string;
  degree: number;
}

export interface GraphLink {
  source: string;
  target: string;
  rel_type: string;
}

export interface GraphSnapshot {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface GraphExpansion {
  entities: KnowledgeEntity[];
  edges: KnowledgeEdge[];
}

export interface EventItem {
  id: string;
  type: string;
  subject: string | null;
  scope: string;
  data: Record<string, unknown>;
  seq: number;
  created_at: string;
}

export interface SearchResult {
  id: string;
  tier: string;
  text: string;
  score: number;
  valid_from: string;
  valid_to: string | null;
  source_episode_id: string;
  epistemic_status: string;
}

export interface CognitionMeta {
  assumptions: Array<{
    id: string; statement: string; domain: string;
    confidence: number; epistemic_status: string;
  }>;
  principles: Array<{
    id: string; statement: string; domain: string; epistemic_status: string;
  }>;
  decision_audits: Array<{
    id: string; decision: string; domain: string;
    predicted_outcome: string | null; actual_outcome: string | null;
  }>;
}

export interface ReflectionReport {
  id: string;
  scope: string;
  report_type: string;
  time_window_start: string;
  time_window_end: string;
  episodes_scanned: number;
  findings: Array<{ statement: string; confidence: number; tags: string[] }>;
  goal_deltas: Array<{ goal: string; status: string; detail: string }>;
  identity_candidates: Array<{ predicate: string; object: string; confidence: number }>;
  summary: string | null;
}

export interface AttentionData {
  allocation: Record<string, number>;
  alignment_gaps: Array<{
    id: string; topic: string; type: string; description: string;
  }>;
  neglected: Array<{
    predicate: string; object: string; confidence: number;
  }>;
}

export interface NarrativeData {
  chapters: Array<{
    id: string; title: string; summary: string | null;
    start: string; end: string | null;
  }>;
  themes: Array<{
    id: string; name: string; description: string; frequency: number;
  }>;
}

// --- Systems & Logs ---------------------------------------------------------

// A single line of a tailed log file.
export type LogLine = string;

export interface LogSource {
  name: string;
  path: string;
  exists: boolean;
  size_bytes: number;
  modified: string | null;
}

export interface LogResponse {
  source: string;
  path: string;
  exists: boolean;
  size_bytes: number;
  modified: string | null;
  lines: LogLine[];
  count: number;
  error?: string;
}

export interface SystemInfra {
  name: string;
  ok: boolean;
  detail: string;
}

export interface SystemEngineEvent {
  id: string;
  type: string;
  subject: string | null;
  created_at: string | null;
  data: Record<string, unknown>;
}

// Mirrors GET /api/systems → engines[], which now comes from the engine
// registry and the scheduler snapshot rather than event-type matching.
export interface SystemEngine {
  name: string;
  label: string;
  category?: string | null;
  schedule?: string | null;
  enabled?: boolean;
  inputs?: string[];
  outputs?: string[];
  last_run?: string | null;
  last_status?: string | null;
  last_error?: string | null;
  runs_24h?: number;
  recent?: SystemEngineEvent[];
  error?: string;
}

// One-line summary of the background scheduler (`_scheduler_summary` in
// api_server) — /api/scheduler has the per-job detail.
export interface SchedulerSummary {
  running: boolean;
  jobs: number;
  failing: string[];
  next_due?: string | null;
}

export interface SystemsStatus {
  timestamp: string;
  infrastructure: SystemInfra[];
  stats: Stats;
  engines: SystemEngine[];
  scheduler?: SchedulerSummary | null;
}

// Autonomous-trigger endpoints return an opaque result dict (or {error,...}).
export type EngineTriggerResult = Record<string, unknown>;

// --- Goal OS -----------------------------------------------------------------

export type GoalHorizon = "life" | "year" | "quarter" | "month" | null;
export type GoalStatus = "active" | "paused" | "achieved" | "abandoned";

export interface GoalReflection {
  status: "active" | "stale" | "on_track" | "blocked" | "completed";
  detail?: string;
  statement?: string;
}

export interface Goal {
  id: string;
  parent_id: string | null;
  title: string;
  description: string | null;
  horizon: GoalHorizon;
  status: GoalStatus;
  priority: number | null;
  identity_refs: string[];
  project_refs: string[];
  success_criteria: string | null;
  progress: number;
  properties: {
    last_reflection?: GoalReflection;
  };
  valid_from: string | null;
  valid_to: string | null;
}

export interface GoalChild {
  id: string;
  title: string;
  status: GoalStatus;
  progress: number;
}

export interface DecisionSummary {
  id: string;
  title: string;
  chosen: string;
  decided_at: string;
}

export interface GoalDetail extends Goal {
  children: GoalChild[];
  decisions: DecisionSummary[];
}

export type GoalPatch = Partial<
  Pick<Goal, "status" | "progress" | "title" | "description" | "horizon" | "priority" | "success_criteria">
>;

export interface CreateGoalBody {
  title: string;
  description?: string;
  horizon?: GoalHorizon;
  parent_id?: string;
  priority?: number;
  success_criteria?: string;
}

export type DecisionReversibility = "reversible" | "costly" | "one_way" | null;

export interface Decision {
  id: string;
  title: string;
  context: string | null;
  options_considered: unknown[];
  chosen: string;
  rationale: string;
  reversibility: DecisionReversibility;
  goal_id: string | null;
  review_at: string | null;
  outcome: string | null;
  audit_id: string | null;
  decided_at: string;
  reviewed_at: string | null;
}

export interface CreateDecisionBody {
  title: string;
  chosen: string;
  rationale: string;
  context?: string;
  reversibility?: DecisionReversibility;
  goal_id?: string;
  review_at?: string;
}

// --- Opportunities -----------------------------------------------------------

export type OpportunityStatus = "detected" | "scored" | "accepted" | "rejected" | "expired";

export interface Opportunity {
  id: string;
  title: string;
  description: string | null;
  source: string | null;
  evidence_refs: string[];
  novelty: number | null;
  value_est: number | null;
  feasibility: number | null;
  score: number | null;
  status: OpportunityStatus;
  resolution: string | null;
  detected_at: string;
  resolved_at: string | null;
}

export interface ResolveOpportunityBody {
  accept: boolean;
  resolution: string;
}

export interface ResolveOpportunityResult {
  id: string;
  status: OpportunityStatus;
  resolution: string;
}

// --- Background jobs (shared/scheduler.py) -----------------------------------
export interface ScheduledJob {
  name: string;
  cadence: string;
  enabled: boolean;
  next_due: string | null;
  last_fired: string | null;
  last_status: string;   // never | completed | failed | skipped_locked | skipped_period_done
  last_error: string | null;
  last_run_id: string | null;
  last_duration_ms: number | null;
  consecutive_failures: number;
}

export interface SchedulerSnapshot {
  running: boolean;
  reason?: string;
  started_at?: string | null;
  history_error?: string;
  jobs: ScheduledJob[];
}

export interface AgentRun {
  run_id: string;
  agent: string;
  job: string | null;
  task: string | null;
  status: string;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
}

export interface AgentRunsResponse {
  items: AgentRun[];
  count: number;
  total: number;
  by_status: Record<string, number>;
}

export interface JobTriggerResult {
  job: string;
  status: string;
  run_id: string | null;
  duration_ms: number | null;
  error: string | null;
  result: unknown;
}
