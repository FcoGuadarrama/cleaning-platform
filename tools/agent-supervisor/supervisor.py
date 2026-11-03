"""Deterministic worker-handover supervisor (runs outside any LLM).

Shep 1.253 selects the coding agent globally (`shep settings agent`), not per feature, so this tool never
changes Shep settings. It classifies a finished worker run, takes an exclusive per-worktree lock, snapshots
disk/DB state, chooses an authenticated subscription-billed successor and emits the handover prompt.
Launching the successor is opt-in (`--launch`) and is recorded as an external, non-Shep-registered run.

Subcommands: classify | snapshot | verify | handover   (see --help)
"""

from __future__ import annotations

import argparse
import contextlib
import datetime as dt
import fcntl
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
from collections.abc import Iterator
from dataclasses import asdict, dataclass, field
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from statefile import atomic_write  # noqa: E402

WORKER_PREFERENCE = ("codex", "gemini", "claude")
MAX_RETRIES = 3
CONTRACTS = ("docs/contracts/openapi.json",)
HANDOVER_PROMPT = (
    "Work in the specified worktree. Read AGENTS.md, WORKTREE_STATE.md, the assigned task, domain summary and "
    "relevant contracts. Inspect git status, staged/unstaged diffs and new files. Check the base SHA, contract "
    "hashes and worktree database/migration state. Preserve completed work: briefly verify that it exists and "
    "meets acceptance, changing it only if evidence shows a problem. Resume the pending microtask while "
    "accounting for changes newer than the checkpoint. Do not discard modifications, reset the database or "
    "repeat external operations. Update WORKTREE_STATE.md before the next WIP commit and record actual "
    "verification results."
)

# Patterns are applied ONLY to structured error events and stderr, never to ordinary stdout/source text.
_QUOTA = re.compile(r"\b(429|rate[ _-]?limit(ed)?|usage limit|quota (exceeded|exhausted)|too many requests)\b", re.I)
_AUTH = re.compile(
    r"\b(401|403|unauthori[sz]ed|not logged in|login required|invalid api key|auth(entication)? failed)\b", re.I
)
_TRANSIENT = re.compile(r"\b(5\d\d|overloaded|timed? ?out|connection (reset|refused)|temporarily unavailable)\b", re.I)
_RETRY_AFTER = re.compile(r"retry[- ]after\D{0,5}(\d+)", re.I)
_ERROR_EVENT_TYPES = {"error", "turn.failed", "result_error"}


def utcnow() -> str:
    return dt.datetime.now(dt.UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


# ---------------------------------------------------------------- classification
@dataclass
class Classification:
    kind: str  # ok | quota | auth | transient | implementation
    evidence: str = ""
    retry_after_s: int | None = None


def _error_messages(events_jsonl: str) -> list[str]:
    """Extract messages from structured error events (codex `exec --json`, claude `stream-json`)."""
    out: list[str] = []
    for line in events_jsonl.splitlines():
        line = line.strip()
        if not line.startswith("{"):
            continue
        try:
            ev = json.loads(line)
        except json.JSONDecodeError:
            continue
        is_error = ev.get("type") in _ERROR_EVENT_TYPES or (ev.get("type") == "result" and ev.get("is_error"))
        if not is_error:
            continue
        err = ev.get("error")
        msg = ev.get("message") or (err.get("message") if isinstance(err, dict) else err) or ev.get("result")
        out.append(str(msg or json.dumps(ev, sort_keys=True)))
    return out


def classify(exit_code: int, stderr: str = "", events_jsonl: str = "") -> Classification:
    if exit_code == 0:
        return Classification("ok")
    signals = _error_messages(events_jsonl) + stderr.strip().splitlines()[-20:]
    for kind, pattern in (("auth", _AUTH), ("quota", _QUOTA), ("transient", _TRANSIENT)):
        for sig in signals:
            if pattern.search(sig):
                m = _RETRY_AFTER.search(sig)
                return Classification(kind, sig[:300], int(m.group(1)) if m else None)
    return Classification("implementation", (signals[-1] if signals else f"exit {exit_code}")[:300])


def backoff_seconds(attempt: int, retry_after: int | None) -> int | None:
    """Bounded retry policy for transient errors; None means stop retrying."""
    if attempt >= MAX_RETRIES:
        return None
    return retry_after if retry_after is not None else min(300, 15 * 2**attempt)


# ---------------------------------------------------------------- lock
class LockBusy(RuntimeError):
    pass


@contextlib.contextmanager
def worktree_lock(root: Path, owner: str) -> Iterator[Path]:
    """Exclusive, non-blocking per-worktree lock. Every launcher must take it before writing files."""
    lock_path = root / ".agent-supervisor" / "worktree.lock"
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    fh = lock_path.open("a+")
    try:
        fcntl.flock(fh, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        fh.seek(0)
        holder = fh.read().strip() or "unknown"
        fh.close()
        raise LockBusy(f"worktree lock held by {holder}") from None
    fh.seek(0)
    fh.truncate()
    fh.write(json.dumps({"owner": owner, "pid": os.getpid(), "since": utcnow()}))
    fh.flush()
    try:
        yield lock_path
    finally:
        fh.truncate(0)
        fcntl.flock(fh, fcntl.LOCK_UN)
        fh.close()


def pid_alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True


# ---------------------------------------------------------------- snapshot
def _git(root: Path, *args: str) -> str:
    return subprocess.run(["git", *args], cwd=root, capture_output=True, text=True, check=False).stdout


def sha256_file(path: Path) -> str | None:
    return hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None


def _migration_state(root: Path) -> str:
    api = root / "apps" / "api"
    if not shutil.which("uv") or not (api / "alembic.ini").is_file():
        return "unknown (uv or alembic.ini missing)"
    env = {**os.environ, **_read_env(root / ".env.worktree")}
    proc = subprocess.run(
        ["uv", "run", "--frozen", "alembic", "current"],
        cwd=api,
        env=env,
        capture_output=True,
        text=True,
        timeout=60,
        check=False,
    )
    lines = (proc.stdout or proc.stderr).strip().splitlines()
    return lines[-1] if lines else f"exit {proc.returncode}"


def _read_env(path: Path) -> dict[str, str]:
    if not path.is_file():
        return {}
    pairs = (ln.split("=", 1) for ln in path.read_text().splitlines() if "=" in ln and not ln.startswith("#"))
    return {k.strip(): v.strip() for k, v in pairs}


@dataclass
class Snapshot:
    taken_at: str
    branch: str
    head: str
    status: str
    staged_diff_stat: str
    unstaged_diff_stat: str
    untracked: list[str]
    contract_hashes: dict[str, str | None]
    compose_project: str | None
    migration: str
    extra: dict[str, str] = field(default_factory=dict)


def take_snapshot(root: Path, with_db: bool = True) -> Snapshot:
    return Snapshot(
        taken_at=utcnow(),
        branch=_git(root, "rev-parse", "--abbrev-ref", "HEAD").strip(),
        head=_git(root, "rev-parse", "HEAD").strip(),
        status=_git(root, "status", "--porcelain=v1"),
        staged_diff_stat=_git(root, "diff", "--cached", "--stat"),
        unstaged_diff_stat=_git(root, "diff", "--stat"),
        untracked=_git(root, "ls-files", "--others", "--exclude-standard").splitlines(),
        contract_hashes={c: sha256_file(root / c) for c in CONTRACTS},
        compose_project=_read_env(root / ".env.worktree").get("COMPOSE_PROJECT_NAME"),
        migration=_migration_state(root) if with_db else "skipped",
    )


def save_snapshot(root: Path, snap: Snapshot) -> Path:
    """Persist snapshot plus full binary-safe patches so nothing on disk is lost."""
    stamp = snap.taken_at.replace(":", "")
    out = root / ".agent-supervisor" / "snapshots" / stamp
    atomic_write(out / "snapshot.json", json.dumps(asdict(snap), indent=2, sort_keys=True))
    atomic_write(out / "staged.patch", _git(root, "diff", "--cached", "--binary"))
    atomic_write(out / "unstaged.patch", _git(root, "diff", "--binary"))
    return out


# ---------------------------------------------------------------- state verification
_STATE_HASH = re.compile(r"(\S+)\s+sha256\s+([0-9a-f]{64})")
_STATE_FIELD = re.compile(r"^- \*\*(?P<k>[^*]+):\*\*\s*(?P<v>.*)$", re.M)


def parse_state(text: str) -> dict[str, str]:
    return {m["k"].strip(): m["v"].strip() for m in _STATE_FIELD.finditer(text)}


def verify_state(root: Path, snap: Snapshot) -> list[str]:
    """Return discrepancies a successor must reconcile (empty list = consistent)."""
    state_path = root / "WORKTREE_STATE.md"
    if not state_path.is_file():
        return ["WORKTREE_STATE.md missing"]
    fields = parse_state(state_path.read_text())
    issues: list[str] = []
    base = fields.get("Base SHA", "")
    is_ancestor = subprocess.run(
        ["git", "merge-base", "--is-ancestor", base, "HEAD"], cwd=root, capture_output=True, check=False
    )
    if base and is_ancestor.returncode != 0:
        issues.append(f"base SHA {base} is not an ancestor of HEAD")
    for path, recorded in _STATE_HASH.findall(fields.get("Contract Version", "")):
        actual = snap.contract_hashes.get(path) or sha256_file(root / path)
        if actual != recorded:
            issues.append(f"contract mismatch {path}: state {recorded[:12]} vs disk {(actual or 'missing')[:12]}")
    issues.extend(_stale_checks(root, fields, snap))
    return issues


def _stale_checks(root: Path, fields: dict[str, str], snap: Snapshot) -> list[str]:
    try:
        updated = dt.datetime.strptime(fields.get("Last Updated", ""), "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=dt.UTC)
    except ValueError:
        return ["Last Updated is missing or not UTC ISO 8601"]
    dirty = [ln[3:].split(" -> ")[-1] for ln in snap.status.splitlines() if ln]
    newer = [
        p
        for p in dirty
        if p != "WORKTREE_STATE.md"
        and (root / p).is_file()
        and dt.datetime.fromtimestamp((root / p).stat().st_mtime, dt.UTC) > updated
    ]
    return [f"disk newer than checkpoint: {', '.join(sorted(newer)[:10])}"] if newer else []


# ---------------------------------------------------------------- successor selection
@dataclass
class WorkerCheck:
    name: str
    installed: bool
    authenticated: bool
    subscription_billing: bool
    detail: str


def _run(cmd: list[str]) -> tuple[int, str]:
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=20, check=False)
    except (OSError, subprocess.TimeoutExpired) as exc:
        return 127, str(exc)
    return p.returncode, (p.stdout + p.stderr).strip()


def check_worker(name: str) -> WorkerCheck:
    if not shutil.which(name):
        return WorkerCheck(name, False, False, False, "not installed")
    if name == "codex":
        code, out = _run(["codex", "login", "status"])
        sub = "chatgpt" in out.lower()
        return WorkerCheck(
            name, True, code == 0 and "logged in" in out.lower(), sub, out.splitlines()[0] if out else ""
        )
    if name == "claude":
        code, out = _run(["claude", "auth", "status"])
        try:
            info = json.loads(out)
        except json.JSONDecodeError:
            return WorkerCheck(name, True, False, False, "unparseable auth status")
        method = str(info.get("authMethod", ""))
        return WorkerCheck(name, True, bool(info.get("loggedIn")), method == "claude.ai", f"authMethod={method}")
    # No documented non-interactive auth probe verified for this CLI yet: never assume authenticated.
    return WorkerCheck(name, True, False, False, "auth probe not implemented; verify manually")


def choose_successor(outgoing: str, checks: dict[str, WorkerCheck]) -> WorkerCheck | None:
    for name in WORKER_PREFERENCE:
        c = checks.get(name)
        if name != outgoing and c and c.installed and c.authenticated and c.subscription_billing:
            return c
    return None


def successor_command(name: str, root: Path, prompt: str) -> list[str]:
    if name == "codex":
        return ["codex", "exec", "--json", "-C", str(root), "-s", "workspace-write", prompt]
    if name == "claude":
        return ["claude", "-p", "--output-format", "stream-json", "--verbose", prompt]
    return [name, prompt]


# ---------------------------------------------------------------- handover
def handover(args: argparse.Namespace, root: Path) -> int:
    cause = classify(args.exit_code, _read(args.stderr), _read(args.events))
    if cause.kind in ("ok", "implementation"):
        print(json.dumps({"action": "no_handover", "cause": asdict(cause)}))
        return 0
    if cause.kind == "transient":
        wait = backoff_seconds(args.attempt, cause.retry_after_s)
        print(json.dumps({"action": "retry_same_worker" if wait is not None else "pause", "wait_s": wait}))
        return 0
    if args.old_pid and pid_alive(args.old_pid):
        print(json.dumps({"action": "abort", "reason": f"outgoing worker pid {args.old_pid} still running"}))
        return 3
    try:
        with worktree_lock(root, owner=f"supervisor:{args.from_agent}->?"):
            return _handover_locked(args, root, cause)
    except LockBusy as exc:
        print(json.dumps({"action": "abort", "reason": str(exc)}))
        return 4


def _handover_locked(args: argparse.Namespace, root: Path, cause: Classification) -> int:
    snap = take_snapshot(root, with_db=not args.no_db)
    snap_dir = save_snapshot(root, snap)
    issues = verify_state(root, snap)
    checks = {n: check_worker(n) for n in WORKER_PREFERENCE}
    succ = choose_successor(args.from_agent, checks)
    prompt = f"{HANDOVER_PROMPT}\n\nWorktree: {root}\nTask: {args.task}\nCause: {cause.kind}.\n" + (
        "Reconcile first:\n- " + "\n- ".join(issues) if issues else ""
    )
    record = {
        "at": utcnow(),
        "outgoing": args.from_agent,
        "incoming": succ.name if succ else None,
        "cause": asdict(cause),
        "task": args.task,
        "snapshot": str(snap_dir.relative_to(root)),
        "discrepancies": issues,
        "workers": {k: asdict(v) for k, v in checks.items()},
        "shep_registered": False,
        "manual_steps": [
            f"shep feat status <feature-id>   # confirm Shep is not retrying {args.from_agent}",
            "shep agent stop <run-id>         # if a Shep retry is still running",
        ],
    }
    if succ is None:
        record["action"] = "pause_all_unavailable"
    elif args.launch:
        record["action"] = "launched_external"
        log = snap_dir / f"{succ.name}.events.jsonl"
        with log.open("w") as fh:
            rc = subprocess.run(successor_command(succ.name, root, prompt), cwd=root, stdout=fh, check=False).returncode
        record["successor_exit"] = rc
    else:
        record["action"] = "ready"
        record["command"] = successor_command(succ.name, root, prompt)
    atomic_write(
        root / ".agent-supervisor" / "handovers" / f"{record['at'].replace(':', '')}.json",
        json.dumps(record, indent=2, sort_keys=True),
    )
    print(json.dumps({k: record[k] for k in ("action", "outgoing", "incoming", "discrepancies", "snapshot")}))
    return 0 if succ else 5


def _read(path: str | None) -> str:
    return Path(path).read_text(errors="replace") if path else ""


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--root", default=None, help="worktree root (default: git toplevel)")
    sub = ap.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("classify")
    c.add_argument("--exit-code", type=int, required=True)
    c.add_argument("--stderr")
    c.add_argument("--events")
    s = sub.add_parser("snapshot")
    s.add_argument("--no-db", action="store_true")
    v = sub.add_parser("verify")
    v.add_argument("--no-db", action="store_true")
    h = sub.add_parser("handover")
    h.add_argument("--from-agent", required=True, choices=WORKER_PREFERENCE)
    h.add_argument("--task", required=True)
    h.add_argument("--exit-code", type=int, required=True)
    h.add_argument("--stderr")
    h.add_argument("--events")
    h.add_argument("--attempt", type=int, default=0)
    h.add_argument("--old-pid", type=int)
    h.add_argument("--no-db", action="store_true")
    h.add_argument("--launch", action="store_true", help="start successor (external, not Shep-registered)")
    args = ap.parse_args(argv)
    root = Path(args.root or _git(Path.cwd(), "rev-parse", "--show-toplevel").strip()).resolve()

    if args.cmd == "classify":
        print(json.dumps(asdict(classify(args.exit_code, _read(args.stderr), _read(args.events)))))
        return 0
    if args.cmd == "snapshot":
        print(save_snapshot(root, take_snapshot(root, with_db=not args.no_db)))
        return 0
    if args.cmd == "verify":
        issues = verify_state(root, take_snapshot(root, with_db=not args.no_db))
        print(json.dumps({"consistent": not issues, "issues": issues}))
        return 0 if not issues else 2
    return handover(args, root)


if __name__ == "__main__":
    sys.exit(main())
