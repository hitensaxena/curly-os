"use client";

// Shared voice state for the whole OS. The orb (writer) pushes its state/caption/
// panel here; the dock and pages (readers) consume it via useVoice(). Mounted at
// the ROOT layout so it wraps BOTH the shell ({children}) and the orb — they are
// siblings, so this is the only level where both are in scope.
import { createContext, useCallback, useContext, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { VoiceState } from "@/components/stage/types";

export type { VoiceState };

// One transient panel of content the orb surfaced (recall snippets, web result,
// think_hard answer, a note, or a graph). Replaces the old floating card stack.
export interface PanelContent {
  kind: "snippets" | "note" | "web" | "task" | "graph" | "list" | "actions";
  id: string;
  ts: number;
  source: string;
  title: string;
  body: string;
  sourcePath: string | null;
  nodeId?: string | null;
  items?: { title: string; subtitle?: string; href?: string; target?: string }[];
}

export interface VoiceHere {
  route: string;
  title: string;
}

export interface VoiceControls {
  start(): void;
  stop(): void;
  sendContext(h: VoiceHere): void;
}

export interface VoiceContextValue {
  state: VoiceState;
  caption: string;
  panel: PanelContent | null;
  panelOpen: boolean;
  here: VoiceHere | null;
  // writer setters (orb only):
  _setState(s: VoiceState): void;
  _setCaption(c: string): void;
  _setPanel(p: PanelContent | null): void;
  _setHere(h: VoiceHere | null): void;
  // reader helpers:
  openPanel(): void;
  closePanel(): void;
  // imperative control so dock/pages can drive the orb (registered by the orb):
  registerControls(c: VoiceControls): void;
  readonly controls: VoiceControls | null;
}

const Ctx = createContext<VoiceContextValue | null>(null);

export function VoiceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<VoiceState>("idle");
  const [caption, setCaption] = useState("");
  const [panel, setPanel] = useState<PanelContent | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [here, setHere] = useState<VoiceHere | null>(null);
  const controlsRef = useRef<VoiceControls | null>(null);

  const _setPanel = useCallback((p: PanelContent | null) => {
    setPanel(p);
    setPanelOpen(p != null);
  }, []);
  const openPanel = useCallback(() => setPanelOpen(true), []);
  const closePanel = useCallback(() => setPanelOpen(false), []);
  const registerControls = useCallback((c: VoiceControls) => {
    controlsRef.current = c;
  }, []);

  const value: VoiceContextValue = {
    state,
    caption,
    panel,
    panelOpen,
    here,
    _setState: setState,
    _setCaption: setCaption,
    _setPanel,
    _setHere: setHere,
    openPanel,
    closePanel,
    registerControls,
    // getter so readers always see the live ref (registered after the orb mounts).
    get controls() {
      return controlsRef.current;
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useVoice(): VoiceContextValue {
  const c = useContext(Ctx);
  if (!c) throw new Error("useVoice must be used within <VoiceProvider>");
  return c;
}
