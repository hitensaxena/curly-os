import type { VoiceState } from "@/components/stage/types";

// Single source for the orb/dock state palette (OS colors): idle=muted,
// listening/connecting=teal, thinking/speaking=indigo, error=rose.
export const VOICE_COLORS: Record<VoiceState, [number, number, number]> = {
  idle: [139, 139, 166],
  connecting: [45, 226, 230],
  listening: [45, 226, 230],
  thinking: [139, 123, 255],
  speaking: [139, 123, 255],
  error: [251, 113, 133],
};

export function voiceRgb(s: VoiceState): string {
  const [r, g, b] = VOICE_COLORS[s];
  return `rgb(${r},${g},${b})`;
}

export const VOICE_LABEL: Record<VoiceState, string> = {
  idle: "Curly",
  connecting: "connecting",
  listening: "listening",
  thinking: "thinking",
  speaking: "speaking",
  error: "error",
};
