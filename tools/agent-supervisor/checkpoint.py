"""Deterministic checkpoint-SHA recorder (runs outside any LLM, no network calls).

This is the concrete implementation of what AGENTS.md means by "the supervisor records
checkpoint SHAs in `.agent-supervisor/`" (see AGENTS.md, WORKTREE_STATE.md checkpoints
section). It is a passive ledger only: it does not retry, classify failures, pick a
successor agent or touch Shep. For that, see supervisor.py. Call this once per WIP commit,
right after `git commit`, so a successor agent (human or AI) can reconstruct exactly which
commits correspond to which microtask without trusting WORKTREE_STATE.md prose alone.

Appends one JSON line per checkpoint to `.agent-supervisor/checkpoints.jsonl` at the worktree
root, using the same atomic-write primitive as statefile.py (temp file + fsync + os.replace),
so a crash mid-write never corrupts or truncates the ledger.

Usage:
    python tools/agent-supervisor/checkpoint.py <sha> <label> [--agent NAME] [--note TEXT] [--root PATH]
    echo '{"sha": "...", "label": "..."}' | python tools/agent-supervisor/checkpoint.py -

Examples:
    python tools/agent-supervisor/checkpoint.py "$(git rev-parse HEAD)" "microtask 6: CI workflow" --agent claude-code
    git commit -qm "wip: alembic migration" && \\
      python tools/agent-supervisor/checkpoint.py "$(git rev-parse HEAD)" "microtask 3: booking locks"
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from statefile import atomic_write  # noqa: E402


def utcnow() -> str:
    return dt.datetime.now(dt.UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def git_toplevel(start: Path) -> Path:
    proc = subprocess.run(
        ["git", "rev-parse", "--show-toplevel"], cwd=start, capture_output=True, text=True, check=False
    )
    if proc.returncode != 0:
        sys.exit("checkpoint.py: not inside a git worktree (git rev-parse --show-toplevel failed)")
    return Path(proc.stdout.strip())


def build_record(args: argparse.Namespace) -> dict[str, str]:
    if args.sha == "-":
        payload = json.loads(sys.stdin.read())
        sha, label = payload.get("sha"), payload.get("label")
        agent, note = payload.get("agent", args.agent), payload.get("note", args.note)
    else:
        sha, label, agent, note = args.sha, args.label, args.agent, args.note
    if not sha or not label:
        sys.exit(f"checkpoint.py: both sha and label are required (got sha={sha!r} label={label!r})")
    return {"at": utcnow(), "sha": sha, "label": label, "agent": agent or "", "note": note or ""}


def append_checkpoint(root: Path, record: dict[str, str]) -> Path:
    """Read-then-atomic-rewrite: the ledger is append-only in effect, but each write is whole-file
    atomic so a crash mid-write can never leave a half-written line or lose prior entries."""
    target = root / ".agent-supervisor" / "checkpoints.jsonl"
    existing = target.read_text(encoding="utf-8") if target.is_file() else ""
    atomic_write(target, existing + json.dumps(record, sort_keys=True) + "\n")
    return target


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("sha", help="commit SHA for this checkpoint, or '-' to read a JSON object from stdin")
    ap.add_argument("label", nargs="?", default=None, help="microtask label, e.g. 'microtask 3: booking locks'")
    ap.add_argument("--agent", default=None, help="agent/CLI that made the checkpoint, e.g. claude-code")
    ap.add_argument("--note", default=None, help="free-form note (no secrets, no customer data)")
    ap.add_argument("--root", default=None, help="worktree root (default: git toplevel of cwd)")
    args = ap.parse_args(argv)
    if args.sha != "-" and not args.label:
        ap.error("label is required unless reading a JSON object from stdin via '-'")
    root = Path(args.root).resolve() if args.root else git_toplevel(Path.cwd())
    record = build_record(args)
    path = append_checkpoint(root, record)
    print(json.dumps({"wrote": str(path), "record": record}, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
