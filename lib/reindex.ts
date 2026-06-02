import { spawn } from "node:child_process";
import path from "node:path";
import { CHROMA_VENV_PYTHON, VAULT } from "@/lib/paths";

const INDEXER_PY = path.join(VAULT, "systems", "indexer.py");

// Fire indexer.py as a detached background subprocess. Indexer is incremental
// and fast (sub-second for a single new file), but we don't want to block the
// API response on it. Errors are logged to stderr of the parent process.
export function triggerReindex(): void {
  const proc = spawn(CHROMA_VENV_PYTHON, [INDEXER_PY], {
    cwd: VAULT,
    detached: true,
    stdio: ["ignore", "ignore", "pipe"],
  });
  proc.stderr?.on("data", (chunk: Buffer) => {
    console.error("[reindex stderr]", chunk.toString("utf8"));
  });
  proc.on("error", (err) => {
    console.error("[reindex spawn error]", err);
  });
  proc.unref();
}
