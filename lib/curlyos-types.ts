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

export interface SystemEngine {
  name: string;
  label: string;
  last_run?: string | null;
  last_event_type?: string | null;
  runs_24h?: number;
  runs_7d?: number;
  recent?: SystemEngineEvent[];
  error?: string;
}

export interface SystemsStatus {
  timestamp: string;
  infrastructure: SystemInfra[];
  stats: Stats;
  engines: SystemEngine[];
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

// --- Agent Runs --------------------------------------------------------------

export type AgentRunStatus = "running" | "parked" | "completed" | "failed" | "cancelled";

export interface AgentRunResult {
  summary?: string;
  steps?: number;
  denied?: string[];
}

export interface AgentRun {
  id: string;
  agent: string;
  task: string;
  status: AgentRunStatus;
  result: AgentRunResult | null;
  error: string | null;
  created_at: string;
  finished_at: string | null;
}

export interface AgentRunAction {
  id: string;
  kind: string;
  payload: {
    tool: string;
    args: Record<string, unknown>;
    cursor?: string;
    why?: string;
  };
  created_at: string;
  observation: Record<string, unknown> | null;
}

export interface AgentRunToolCall {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  entry_hash: string;
  created_at: string;
}

export interface AgentRunApproval {
  apv_id: string;
  action_class: string;
  payload: {
    tool?: string;
    args?: Record<string, unknown>;
    why?: string;
    cursor?: string;
  } | null;
  state: string;
  origin: string;
  created_at: string;
  decided_at: string | null;
}

export interface AgentRunDetail extends AgentRun {
  actions: AgentRunAction[];
  tool_calls: AgentRunToolCall[];
  approvals: AgentRunApproval[];
}

export interface CreateRunBody {
  task: string;
}

export interface CreateRunResult {
  run_id: string;
  status: string;
}

export interface RunActionResult {
  run_id: string;
  status: string;
}

// --- Approvals ---------------------------------------------------------------

export type ApprovalOrigin = "agent" | "human";

export interface PendingApproval {
  apv_id: string;
  run_id: string | null;
  origin: ApprovalOrigin;
  action_class: string;
  payload: {
    tool?: string;
    args?: Record<string, unknown>;
    why?: string;
    cursor?: string;
  } | null;
  expires_at: string | null;
  created_at: string;
}

export interface ApprovalActionResult {
  apv_id: string;
  state: string;
  run_id: string | null;
  action_class: string;
  resumed?: boolean;
}

// --- Simulation Runs (extended) ----------------------------------------------

export interface SimScenarioOutcome {
  scenarios: Record<string, number>;
  implications: string;
}

export interface SimRunExtended {
  id: string;
  scope: string | null;
  question: string;
  world_model_id: string | null;
  status: string;
  epistemic_status: string;
  outcome_distribution: SimScenarioOutcome | Record<string, number> | unknown[] | null;
  parameters: Record<string, unknown> | null;
  created_at: string;
  completed_at: string | null;
}

export interface SimExecuteResult {
  sim_id: string;
  scenarios: number;
  outcome: Record<string, number>;
  implications: string;
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

export interface DiscoveryScanResult {
  proposed: number;
  created: string[];
  created_count: number;
}

// --- Decision Council --------------------------------------------------------

export interface CouncilPerspective {
  perspective: string;
  view: string;
}

export interface CouncilResult {
  dec_id: string;
  perspectives: CouncilPerspective[];
  synthesis: string;
}

// Extended Decision with optional council
export interface DecisionWithCouncil extends Decision {
  properties?: {
    council?: CouncilResult;
  };
}

// --- SSE Events --------------------------------------------------------------

export interface SseEvent {
  seq: number;
  type: string;
  subject: string | null;
  data: Record<string, unknown>;
  at: string;
}
