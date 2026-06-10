// Server-only OpenRouter access for the webapp chat. The model is configurable
// via CURLYOS_CHAT_MODEL; the API key comes from the environment, falling back
// to ~/.hermes/.env (the same source curlyos-core reads).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
export const CHAT_MODEL = process.env.CURLYOS_CHAT_MODEL ?? "openrouter/owl-alpha";

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
