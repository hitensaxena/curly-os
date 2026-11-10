import os from "node:os";

// Filesystem roots the server needs. Everything else the app reads now comes
// from curlyos-core over HTTP (/api/*) — there is no local markdown vault.
//
// Removed with the lean refactor (2026-11-10): VAULT (`~/mind`), KG_ROOT
// (`~/knowledge-graph`), WA_BRIDGE_* (`~/code/wa-bridge`), CODE_ROOT
// (`~/code`), CHROMA_VENV_PYTHON and CLAUDE_CHAT_PY. None of those paths
// exist on this machine, and after /notes, /journal, /care, /projects and the
// studio/workspace pages were dropped, nothing imported them. `~/mind` was
// NOT repointed at the core repo's `memory/` or `knowledge/` — those are
// Python packages, not markdown notes.
export const HOME = os.homedir();
