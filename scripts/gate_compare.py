#!/usr/bin/env python3
"""M0 go/no-go gate: compare brain /rag against mind's query.py on a fixed set of
hand-picked queries spanning the vault's domains. Prints a compact side-by-side so
a human can judge whether brain retrieval beats or clearly complements mind's.

  brain : bge-small-en-v1.5 vectors + typed nodes + ready-to-prompt context
  mind  : MiniLM (all-MiniLM-L6-v2) vectors via systems/query.py over mind_vault
"""
from __future__ import annotations

import json
import os
import subprocess
import urllib.request
from pathlib import Path

HOME = Path.home()
BRAIN = "http://127.0.0.1:8077"
MIND_PY = HOME / "mind" / "systems" / "chroma-venv" / "bin" / "python"
QUERY_PY = HOME / "mind" / "systems" / "query.py"

QUERIES = [
    "Advaita Vedanta and non-dual awareness",
    "my current goals at Mintrix and establishing creative authority",
    "ADHD as inexpressibility and writing as an expression channel",
    "my relationship with Jahnvi",
    "music production setup — Ableton and Akai MPK",
    "my health conditions and lab results",
    "Interface Theory, QBism and the nature of perception",
    "maya versus base-reality oscillation",
    "my daily routine and the evening walk",
    "creative aesthetic preferences — dark, immersive, neon, portals",
]


def api_key() -> str:
    env = HOME / "brain" / ".env"
    for line in env.read_text().splitlines():
        if line.startswith("BRAIN_API_KEYS="):
            return line.split("=", 1)[1].split(",")[0].strip()
    return ""


KEY = api_key()


def brain_rag(query: str, k: int = 6) -> dict:
    req = urllib.request.Request(
        BRAIN + "/rag",
        data=json.dumps({"query": query, "k": k}).encode(),
        method="POST",
    )
    req.add_header("Content-Type", "application/json")
    req.add_header("X-API-Key", KEY)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


def mind_query(query: str, k: int = 6) -> list[dict]:
    out = subprocess.run(
        [str(MIND_PY), str(QUERY_PY), "--json", query, str(k)],
        capture_output=True, text=True, timeout=60,
    ).stdout.strip()
    try:
        data = json.loads(out)
        return data.get("hits", []) if data.get("ok") else []
    except Exception:
        return []


def short(s: str, n: int = 46) -> str:
    s = " ".join((s or "").split())
    return s[:n] + ("…" if len(s) > n else "")


def main() -> None:
    for qi, q in enumerate(QUERIES, 1):
        print(f"\n{'='*78}\n[{qi}] {q}\n{'='*78}")
        rag = brain_rag(q)
        bhits = rag.get("hits", [])
        print(f"BRAIN  (hits={len(bhits)}  related={len(rag.get('related',[]))}  edges={len(rag.get('edges',[]))})")
        for h in bhits[:4]:
            path = (h.get("metadata") or {}).get("path", "")
            print(f"   {h.get('_score',0):.3f}  {short(h.get('title') or h.get('id'),38):40}  {short(path,30)}")
        mind = mind_query(q)
        print(f"MIND   (hits={len(mind)})")
        for h in mind[:4]:
            # mind distance: lower = closer; convert to rough similarity for eyeballing
            sim = 1.0 - float(h.get("distance", 1.0))
            print(f"   {sim:.3f}  {short(h.get('title') or h.get('path'),38):40}  {short(h.get('path'),30)}")
    print("\n" + "="*78)
    print("Judge: does BRAIN surface the right notes as well as / better than MIND?")


if __name__ == "__main__":
    main()
