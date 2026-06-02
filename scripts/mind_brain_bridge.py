#!/usr/bin/env python3
"""mind -> brain sync bridge.

Idempotent, git-diff-driven. Mirrors ~/mind markdown into the brain service as
nodes with deterministic ids ("mind:<vault-relative-path>"), so a re-ingest is an
UPSERT rather than a duplicate. Handles add / modify / delete / rename. Safe to
run repeatedly on a systemd timer; a flock guard prevents overlapping runs.

  mind markdown = canonical truth.  brain = derived, additive.
  Only this bridge writes source_app="mind" nodes.

Usage:
  mind_brain_bridge.py            # incremental (auto full-backfill if no state)
  mind_brain_bridge.py --reset    # ignore saved state, full backfill
  mind_brain_bridge.py --dry-run  # show what would change, touch nothing

Config (env overrides):
  MIND_DIR       (default ~/mind)
  BRAIN_URL      (default http://127.0.0.1:8077)
  BRAIN_API_KEY  (default: first key in ~/brain/.env BRAIN_API_KEYS)
  BRIDGE_STATE   (default <repo>/data/bridge_state.json)
"""
from __future__ import annotations

import argparse
import fcntl
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

HOME = Path.home()
MIND = Path(os.environ.get("MIND_DIR", HOME / "mind"))
REPO = Path(__file__).resolve().parent.parent  # ~/code/curly-os
STATE_PATH = Path(os.environ.get("BRIDGE_STATE", REPO / "data" / "bridge_state.json"))
LOCK_PATH = STATE_PATH.with_suffix(".lock")
BRAIN_URL = os.environ.get("BRAIN_URL", "http://127.0.0.1:8077").rstrip("/")

# Top-level vault dirs to skip. archives/ = bulky, low-signal ChatGPT history that
# adds RAG noise and dominates backfill time; systems/ = tooling + venv. Override
# with BRIDGE_EXCLUDE=systems (to include archives) or any comma-separated set.
EXCLUDE_TOP_DIRS = {
    d.strip() for d in os.environ.get("BRIDGE_EXCLUDE", "systems,archives").split(",") if d.strip()
}

# Top-level vault folder -> brain node `type` (enables /search?type= and /nodes?type=).
FOLDER_TYPE = {
    "journals": "journal", "projects": "project", "philosophy": "philosophy",
    "ai-context": "context", "memoirs": "memoir", "dreams": "dream",
    "health": "health", "music": "music", "relationships": "relationship",
    "spirituality": "spirituality", "identity": "identity", "media": "media",
    "archives": "archive", "agents": "agent-output", "knowledge": "knowledge",
    "ideas": "idea", "prompts": "prompt", "experiments": "experiment",
    "finances": "finance",
}


def log(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


def api_key() -> str:
    k = os.environ.get("BRAIN_API_KEY")
    if k:
        return k
    env = HOME / "brain" / ".env"
    if env.exists():
        for line in env.read_text().splitlines():
            if line.startswith("BRAIN_API_KEYS="):
                return line.split("=", 1)[1].split(",")[0].strip()
    return ""


KEY = api_key()


def http(method: str, path: str, body=None, timeout: int = 180):
    req = urllib.request.Request(
        BRAIN_URL + path,
        # default=str: YAML frontmatter can hold date/datetime objects that aren't
        # JSON-serializable; stringify them rather than crash the whole backfill.
        data=json.dumps(body, default=str).encode() if body is not None else None,
        method=method,
    )
    req.add_header("Content-Type", "application/json")
    if KEY:
        req.add_header("X-API-Key", KEY)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode(errors="replace")
    except urllib.error.URLError as e:
        return 0, str(e)


def git(*args: str) -> str:
    # core.quotePath=false => raw UTF-8 paths (no octal/quote escaping), so
    # filenames with spaces or non-ASCII are read/deleted correctly.
    return subprocess.run(
        ["git", "-C", str(MIND), "-c", "core.quotePath=false", *args],
        check=True, capture_output=True, text=True,
    ).stdout


def ensure_committed() -> None:
    """mind's autocommit timer may be lagging/dead; snapshot a dirty tree so the
    git diff reflects on-disk reality before we sync."""
    if git("status", "--porcelain").strip():
        git("add", "-A")
        subprocess.run(
            ["git", "-C", str(MIND), "commit", "-m", "auto: bridge snapshot"],
            capture_output=True, text=True,
        )
        log("bridge: committed dirty mind tree before diff")


def head() -> str:
    return git("rev-parse", "HEAD").strip()


def is_md(path: str) -> bool:
    return path.endswith(".md") and path.split("/", 1)[0] not in EXCLUDE_TOP_DIRS


def all_md() -> list[str]:
    return [p for p in git("ls-files", "*.md").splitlines() if is_md(p)]


def diff_since(sha: str):
    """[(op, path, newpath|None)] from `git diff -M`. R = rename (find-renames
    is mandatory: without -M a rename shows as D+A and orphans entity edges)."""
    out = git("diff", "-M", "--name-status", f"{sha}..HEAD")
    changes = []
    for line in out.splitlines():
        parts = line.split("\t")
        status = parts[0]
        if status.startswith("R") and len(parts) >= 3:
            changes.append(("R", parts[1], parts[2]))
        elif status.startswith("D"):
            changes.append(("D", parts[1], None))
        else:  # A, M, C, T
            changes.append(("A", parts[1], None))
    return changes


def node_id(path: str) -> str:
    return "mind:" + path


def derive_type(path: str) -> str:
    return FOLDER_TYPE.get(path.split("/", 1)[0], "note")


def parse_frontmatter(text: str):
    """Return (meta_dict, title, tags). Uses PyYAML if available, else best-effort."""
    meta, title, tags = {}, None, []
    if text.startswith("---\n"):
        end = text.find("\n---", 4)
        if end != -1:
            block = text[4:end]
            try:
                import yaml  # type: ignore
                parsed = yaml.safe_load(block)
                meta = parsed if isinstance(parsed, dict) else {}
            except Exception:
                meta = {}
            if meta:
                title = meta.get("title")
                t = meta.get("tags") or meta.get("topics") or []
                if isinstance(t, str):
                    tags = [s.strip() for s in t.split(",") if s.strip()]
                elif isinstance(t, list):
                    tags = [str(s) for s in t]
    return meta, title, tags


def first_heading(text: str):
    for line in text.splitlines():
        if line.startswith("# "):
            return line[2:].strip()
    return None


def build_payload(path: str, text: str) -> dict:
    meta, fm_title, tags = parse_frontmatter(text)
    title = fm_title or first_heading(text) or Path(path).stem.replace("-", " ")
    return {
        "id": node_id(path),
        "content": text,
        "type": derive_type(path),
        "title": title,
        "source_app": "mind",
        "tags": tags,
        "metadata": {"path": path, "folder": path.split("/", 1)[0], "frontmatter": meta},
        "extract": False,  # M0: entities deferred to M4; brain config also EXTRACTOR=none
    }


def ingest_file(path: str, retries: int = 2) -> bool:
    fp = MIND / path
    if not fp.exists():
        return True  # vanished between diff and read; a later run/delete handles it
    try:
        payload = build_payload(path, fp.read_text(errors="replace"))
        st = None
        for attempt in range(retries + 1):
            st, _ = http("POST", "/ingest", payload)
            if st == 200:
                return True
            time.sleep(1 + attempt)
        log(f"bridge: INGEST FAIL {st} {path}")
        return False
    except Exception as e:  # one bad file must never abort the whole sync
        log(f"bridge: INGEST ERROR {path}: {e}")
        return False


def delete_path(path: str) -> bool:
    url = "/nodes/" + urllib.parse.quote(node_id(path), safe=":/")
    st, _ = http("DELETE", url)
    if st not in (200, 404):
        log(f"bridge: DELETE FAIL {st} {path}")
        return False
    return True


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--reset", action="store_true", help="ignore state, full backfill")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    lock = open(LOCK_PATH, "w")
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        log("bridge: another run in progress; exiting")
        return 0

    st, _ = http("GET", "/health", timeout=10)
    if st != 200:
        log(f"bridge: brain not healthy (status {st}) at {BRAIN_URL}; aborting")
        return 2

    if not args.dry_run:
        ensure_committed()
    hsha = head()

    state = {}
    if STATE_PATH.exists() and not args.reset:
        try:
            state = json.loads(STATE_PATH.read_text())
        except Exception:
            state = {}
    last = state.get("last_synced_sha")
    prev_failed = state.get("failed", [])

    if not last or args.reset:
        log(f"bridge: FULL BACKFILL at {hsha[:8]}")
        changes = [("A", p, None) for p in all_md()]
    else:
        try:
            changes = diff_since(last)
        except subprocess.CalledProcessError:
            log(f"bridge: diff from {last[:8]} failed (history changed?); full backfill")
            changes = [("A", p, None) for p in all_md()]
        # retry anything that failed last run
        changes += [("A", p, None) for p in prev_failed if (MIND / p).exists()]
        log(f"bridge: incremental {last[:8]}..{hsha[:8]} — {len(changes)} changes")

    if args.dry_run:
        for op, p, np in changes[:60]:
            log(f"  {op} {p}{' -> ' + np if np else ''}")
        log(f"bridge: dry-run, {len(changes)} total change(s)")
        return 0

    ok = fail = deleted = 0
    failed: list[str] = []
    total = len(changes)
    t0 = time.time()
    for i, (op, path, newpath) in enumerate(changes, 1):
        if op == "D":
            deleted += 1 if delete_path(path) else 0
        elif op == "R":
            delete_path(path)
            if ingest_file(newpath):
                ok += 1
            else:
                failed.append(newpath)
                fail += 1
        else:
            if not is_md(path):
                continue
            if ingest_file(path):
                ok += 1
            else:
                failed.append(path)
                fail += 1
        if i % 100 == 0 or i == total:
            log(f"bridge: {i}/{total} (ok={ok} del={deleted} fail={fail}) {time.time()-t0:.0f}s")

    STATE_PATH.write_text(json.dumps(
        {"last_synced_sha": hsha, "failed": failed,
         "updated_at": time.strftime("%Y-%m-%dT%H:%M:%S%z")},
        indent=2,
    ))
    _, stats = http("GET", "/stats")
    log(f"bridge: done — ingested {ok}, deleted {deleted}, failed {fail}; brain {stats}")
    return 0 if fail == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
