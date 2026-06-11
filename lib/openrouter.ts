// Server-only OpenRouter access for the webapp chat. The model is configurable
// via CURLYOS_CHAT_MODEL; the API key comes from the environment, falling back
// to ~/.hermes/.env (the same source curlyos-core reads).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
export const CHAT_MODEL = process.env.CURLYOS_CHAT_MODEL ?? "openrouter/owl-alpha";

// Ordered failover chain (primary first, then backups). Mirrors curlyos-core's
// CURLYOS_MODEL_CHAIN; on a 429/error from one model the chat route tries the
// next (the :free backups rate-limit often).
const DEFAULT_CHAIN =
  "openrouter/owl-alpha,nex-agi/nex-n2-pro:free,nvidia/nemotron-3-ultra-550b-a55b:free";
export const CHAT_MODEL_CHAIN: string[] = (() => {
  const raw = process.env.CURLYOS_MODEL_CHAIN ?? DEFAULT_CHAIN;
  const chain = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return [CHAT_MODEL, ...chain.filter((m) => m !== CHAT_MODEL)];
})();

let _key: string | null = null;

export function openrouterKey(): string {
  if (_key !== null) return _key;
  if (process.env.OPENROUTER_API_KEY) return (_key = process.env.OPENROUTER_API_KEY);
  try {
    const env = fs.readFileSync(path.join(os.homedir(), ".hermes", ".env"), "utf8");
    for (const line of env.split("\n")) {
      const t = line.trim();
      if (t.startsWith("OPENROUTER_API_KEY=")) {
        return (_key = t.slice("OPENROUTER_API_KEY=".length).replace(/^["']|["']$/g, "").trim());
      }
    }
  } catch {
    /* no ~/.hermes/.env */
  }
  return (_key = "");
}
