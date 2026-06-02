// Shared types for the voice-first OS "stage" — mirrors the curly-voice WS
// wire contract (server.ts emitUI: {type:'ui', intent, id, ts, source, payload}).

export type StageKind = 'snippets' | 'note' | 'web' | 'task' | 'list' | 'actions';

// A structured row for 'list'/'actions' panels (options, steps, links).
export interface PanelItem {
  title: string;
  subtitle?: string;
  href?: string; // internal route or note path (rendered as a Link)
  target?: string; // a navigate target resolved client-side (an action)
}

export interface ShowPayload {
  kind: StageKind;
  title: string;
  body: string;
  sourcePath: string | null;
  items?: PanelItem[];
}

export interface NavPayload {
  target: string;
}

export interface GraphPayload {
  nodeId: string | null;
  title?: string;
}

export interface UIFrame {
  type: 'ui';
  intent: 'show' | 'navigate' | 'clear' | 'graph';
  id: string;
  ts: number;
  source: string;
  payload?: ShowPayload | NavPayload | GraphPayload | Record<string, never>;
}

export interface ContentCard {
  kind: StageKind;
  id: string;
  ts: number;
  source: string;
  title: string;
  body: string;
  sourcePath: string | null;
  items?: PanelItem[];
}

export interface GraphCard {
  kind: 'graph';
  id: string;
  ts: number;
  source: string;
  title: string;
  nodeId: string | null;
}

export type StageCard = ContentCard | GraphCard;

// force-graph shapes (what /api/graph returns)
export interface StageGraphNode {
  id: string;
  label: string;
  group: string;
  val: number;
}
export interface StageGraphLink {
  source: string;
  target: string;
  rel?: string;
}
export interface StageGraph {
  nodes: StageGraphNode[];
  links: StageGraphLink[];
}

export type VoiceState = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error';
