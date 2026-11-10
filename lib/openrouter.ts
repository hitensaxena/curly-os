// Server-only LLM access for the webapp chat.
//
// Speaks the OpenAI chat-completions protocol to any compatible endpoint. The
// default is the local OpenCode Go bridge (127.0.0.1:8799, launchd
// `art.curlybrackets.opencode-go-bridge`) — it owns the `x-opencode-session`
// header and rotates the short-lived token, so this file only needs a base URL.
//
// Override with CURLYOS_CHAT_BASE_URL / CURLYOS_CHAT_MODEL / CURLYOS_CHAT_API_KEY
// to point chat at any other OpenAI-compatible provider.
const BASE = (
  process.env.CURLYOS_CHAT_BASE_URL ?? "http://127.0.0.1:8799/v1"
).replace(/\/+$/, "");

export const CHAT_COMPLETIONS_URL = `${BASE}/chat/completions`;
export const CHAT_MODEL = process.env.CURLYOS_CHAT_MODEL ?? "kimi-k3";

// Ordered failover chain (primary first, then backups). A model that 429s or
// errors before the stream opens is skipped for the next. All three are
// verified available on the OpenCode Go plan.
const DEFAULT_CHAIN = "kimi-k3,claude-haiku-5-5,glm-5.3";
export const CHAT_MODEL_CHAIN: string[] = (() => {
  const raw = process.env.CURLYOS_CHAT_MODEL_CHAIN ?? DEFAULT_CHAIN;
  const chain = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return [CHAT_MODEL, ...chain.filter((m) => m !== CHAT_MODEL)];
})();

export function chatKey(): string {
  // The local bridge ignores the value; kept so any OpenAI-compatible provider
  // works by setting one env var.
  return process.env.CURLYOS_CHAT_API_KEY ?? "bridge";
}
