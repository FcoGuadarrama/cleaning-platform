"""Simulated-failure tests for the handover supervisor.

Run: uv run --no-project --python 3.15 python -m unittest tools/agent-supervisor/test_supervisor.py

No real quota is consumed: worker availability is stubbed and nothing is launched.
"""

from __future__ import annotations

import hashlib
import io
import json
import os
import subprocess
import sys
import tempfile
import time
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent))
import supervisor as sv  # noqa: E402

STATE = """# WORKTREE STATE & HANDOFF LOG
- **Feature:** t-1
- **Current Agent:** codex-cli
- **Last Updated:** {updated}
- **Branch / Worktree:** main @ tmp
- **Base SHA:** {base}
- **Contract Version:** docs/contracts/openapi.json sha256 {contract}
- **Database:** none
"""


def git(root: Path, *args: str) -> None:
    subprocess.run(["git", *args], cwd=root, check=True, capture_output=True)


class Repo:
    def __init__(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        git(self.root, "init", "-q", "-b", "main")
        git(self.root, "config", "user.email", "test@test.com")
        git(self.root, "config", "user.name", "test")
        (self.root / "docs/contracts").mkdir(parents=True)
        (self.root / "docs/contracts/openapi.json").write_text('{"openapi":"3.1.0"}')
        (self.root / "app.py").write_text("x = 1\n")
        git(self.root, "add", ".")
        git(self.root, "commit", "-qm", "base")
        self.base = subprocess.run(
            ["git", "rev-parse", "HEAD"], cwd=self.root, capture_output=True, text=True, check=True
        ).stdout.strip()

    def contract_hash(self) -> str:
        return hashlib.sha256((self.root / "docs/contracts/openapi.json").read_bytes()).hexdigest()

    def write_state(self, updated: str | None = None, contract: str | None = None, base: str | None = None) -> None:
        (self.root / "WORKTREE_STATE.md").write_text(
            STATE.format(
                updated=updated or sv.utcnow(), base=base or self.base, contract=contract or self.contract_hash()
            )
        )


def workers(**auth: bool) -> dict[str, sv.WorkerCheck]:
    return {
        n: sv.WorkerCheck(n, auth.get(n, False), auth.get(n, False), auth.get(n, False), "stub")
        for n in sv.WORKER_PREFERENCE
    }


def run_handover(root: Path, *extra: str) -> tuple[int, dict[str, object]]:
    buf = io.StringIO()
    with redirect_stdout(buf):
        rc = sv.main(
            ["--root", str(root), "handover", "--from-agent", "codex", "--task", "docs/tasks/t-1.md", "--no-db", *extra]
        )
    return rc, json.loads(buf.getvalue().strip().splitlines()[-1])


class ClassifyTests(unittest.TestCase):
    def test_simulated_quota_from_structured_event(self) -> None:
        ev = json.dumps({"type": "error", "message": "You've hit your usage limit. Retry-After: 120"})
        c = sv.classify(1, events_jsonl=ev)
        self.assertEqual((c.kind, c.retry_after_s), ("quota", 120))

    def test_quota_words_in_ordinary_output_are_not_evidence(self) -> None:
        ordinary = json.dumps({"type": "item.completed", "item": {"text": 'raise RateLimit("quota exceeded")'}})
        self.assertEqual(sv.classify(1, stderr="AssertionError: 2 != 3", events_jsonl=ordinary).kind, "implementation")

    def test_auth_failure_is_not_quota(self) -> None:
        self.assertEqual(sv.classify(1, stderr="Error: 401 Unauthorized - not logged in").kind, "auth")

    def test_ordinary_code_failure(self) -> None:
        self.assertEqual(sv.classify(2, stderr="FAILED tests/test_x.py::test_y").kind, "implementation")

    def test_success(self) -> None:
        self.assertEqual(sv.classify(0, stderr="rate limit").kind, "ok")

    def test_transient_backoff_is_bounded(self) -> None:
        self.assertEqual(sv.backoff_seconds(0, None), 15)
        self.assertEqual(sv.backoff_seconds(1, 7), 7)
        self.assertIsNone(sv.backoff_seconds(sv.MAX_RETRIES, None))


class HandoverTests(unittest.TestCase):
    def setUp(self) -> None:
        self.repo = Repo()
        self.root = self.repo.root
        self.logs = tempfile.TemporaryDirectory()  # CLI logs live outside the worktree
        self.quota = Path(self.logs.name) / "events.jsonl"
        self.quota.write_text(json.dumps({"type": "turn.failed", "error": {"message": "429 Too Many Requests"}}))

    def tearDown(self) -> None:
        self.repo.tmp.cleanup()
        self.logs.cleanup()

    def test_quota_hands_over_to_next_authenticated_worker(self) -> None:
        self.repo.write_state()
        with mock.patch.object(sv, "check_worker", side_effect=lambda n: workers(claude=True)[n]):
            rc, out = run_handover(self.root, "--exit-code", "1", "--events", str(self.quota))
        self.assertEqual((rc, out["action"], out["incoming"]), (0, "ready", "claude"))
        self.assertEqual(out["discrepancies"], [])

    def test_termination_during_edit_preserves_partial_work(self) -> None:
        self.repo.write_state(updated="2020-01-01T00:00:00Z")
        (self.root / "app.py").write_text("x = 1\ny = 'half-writ")
        (self.root / "new_module.py").write_text("pending = True\n")
        with mock.patch.object(sv, "check_worker", side_effect=lambda n: workers(claude=True)[n]):
            _, out = run_handover(self.root, "--exit-code", "137", "--stderr", str(self._stderr("quota exceeded")))
        snap = self.root / str(out["snapshot"])
        self.assertIn("half-writ", (snap / "unstaged.patch").read_text())
        self.assertIn("new_module.py", json.loads((snap / "snapshot.json").read_text())["untracked"])
        self.assertTrue(any("disk newer than checkpoint" in d for d in out["discrepancies"]))
        self.assertEqual((self.root / "app.py").read_text(), "x = 1\ny = 'half-writ")  # nothing reset

    def test_contract_mismatch_is_reported(self) -> None:
        self.repo.write_state(contract="0" * 64)
        with mock.patch.object(sv, "check_worker", side_effect=lambda n: workers(claude=True)[n]):
            _, out = run_handover(self.root, "--exit-code", "1", "--events", str(self.quota))
        self.assertTrue(any("contract mismatch" in d for d in out["discrepancies"]))

    def test_stale_base_sha_is_reported(self) -> None:
        self.repo.write_state(base="f" * 40)
        issues = sv.verify_state(self.root, sv.take_snapshot(self.root, with_db=False))
        self.assertTrue(any("base SHA" in i for i in issues))

    def test_concurrent_takeover_is_refused(self) -> None:
        self.repo.write_state()
        with sv.worktree_lock(self.root, owner="other-launcher"):
            rc, out = run_handover(self.root, "--exit-code", "1", "--events", str(self.quota))
        self.assertEqual((rc, out["action"]), (4, "abort"))
        self.assertIn("other-launcher", str(out["reason"]))

    def test_live_outgoing_worker_blocks_handover(self) -> None:
        self.repo.write_state()
        rc, out = run_handover(
            self.root, "--exit-code", "1", "--events", str(self.quota), "--old-pid", str(os.getpid())
        )
        self.assertEqual((rc, out["action"]), (3, "abort"))

    def test_all_workers_unavailable_pauses(self) -> None:
        self.repo.write_state()
        with mock.patch.object(sv, "check_worker", side_effect=lambda n: workers()[n]):
            rc, out = run_handover(self.root, "--exit-code", "1", "--events", str(self.quota))
        self.assertEqual((rc, out["action"]), (5, "pause_all_unavailable"))

    def test_api_key_billing_is_never_selected(self) -> None:
        checks = workers(claude=True)
        checks["claude"].subscription_billing = False
        self.assertIsNone(sv.choose_successor("codex", checks))

    def test_code_failure_does_not_hand_over(self) -> None:
        _, out = run_handover(self.root, "--exit-code", "1", "--stderr", str(self._stderr("SyntaxError: bad")))
        self.assertEqual(out["action"], "no_handover")

    def test_atomic_write_leaves_no_temp_files(self) -> None:
        target = self.root / "WORKTREE_STATE.md"
        sv.atomic_write(target, "a")
        time.sleep(0.01)
        sv.atomic_write(target, "b")
        self.assertEqual(target.read_text(), "b")
        self.assertEqual([p.name for p in self.root.glob(".WORKTREE_STATE.md.*")], [])

    def _stderr(self, text: str) -> Path:
        p = Path(self.logs.name) / "stderr.txt"
        p.write_text(text)
        return p


if __name__ == "__main__":
    unittest.main()
