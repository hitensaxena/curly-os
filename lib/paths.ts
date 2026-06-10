import path from "node:path";
import os from "node:os";

export const HOME = os.homedir();
export const VAULT = path.join(HOME, "mind");
// Allowlist root for project `code:` dirs — bounds where the per-project chat's
// agentic Curly is allowed to operate (read/edit/run) for code projects.
export const CODE_ROOT = path.join(HOME, "code");
export const CHROMA_VENV_PYTHON = path.join(VAULT, "systems", "chroma-venv", "bin", "python");
export const CLAUDE_CHAT_PY = path.join(VAULT, "systems", "claude_chat.py");

// Curated Indian non-dual philosophy knowledge graph — separate Python
// project that emits intermediate.json + a Neo4j cypher file. We read
// intermediate.json directly; Neo4j is not required.
export const KG_ROOT = path.join(HOME, "knowledge-graph");
export const KG_INTERMEDIATE = path.join(KG_ROOT, "data", "intermediate.json");

// wa-bridge — sibling Node service that puppets WhatsApp Web and forwards
// messages to /api/whatsapp/incoming. Shares its SQLite log with this app
// (read-only here) and its PAUSED kill switch (toggle via /whatsapp).
export const WA_BRIDGE_ROOT = path.join(HOME, "code", "wa-bridge");
export const WA_BRIDGE_DB = path.join(WA_BRIDGE_ROOT, "data", "log.db");
export const WA_BRIDGE_PAUSED_FILE = path.join(WA_BRIDGE_ROOT, "data", "PAUSED");
