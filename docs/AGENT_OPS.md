# Agent operations: Shep, routing, failover, handover

## Capability report (verified 2026-11-03 on the owner's Mac)
| Tool | Version | Status |
|---|---|---|
| Shep | 1.253.1 | Installed. Global agent = `claude-code` (`shep settings show`). |
| Codex CLI | 0.165.0 | Installed, `codex login status` → ChatGPT subscription. Reads `AGENTS.md` natively (verified: `codex exec --json -s read-only` quoted a hard rule verbatim). |
| Claude Code | 2.1.311 | Installed, `claude auth status` → `authMethod: claude.ai` (subscription). Reads `CLAUDE.md` → symlink → `AGENTS.md` (this session loaded it). |
| Gemini CLI | — | **Not installed.** `GEMINI.md` symlink is ready; supervisor reports it unavailable. |
| Cursor CLI | — | Not installed. `.cursor/rules/agents.mdc` (alwaysApply) points at `AGENTS.md`. |

### What Shep provides natively
- Per-feature worktrees, lifecycle (`feat new/start/resume/status/wait/logs/approve/reject`), git checkpoints per
  step (`feat checkpoints/restore`), `agent stop`, review gating, decision questions (MCP `ask_decision`).
- Per-run **model** override (`shep feat new --model`), **not** per-feature agent/provider selection.
- Agent type is **global** (`shep settings agent --agent <type>`). No documented automatic cross-provider failover,
  quota signal or retry-suspension flag was found in `--help` output.

### Consequences (honest status)
| Capability | Status |
|---|---|
| Worktree + per-worktree MySQL isolation | ✅ works (`scripts/wt-env.sh`, compose project per worktree) |
| Shared instructions across Codex/Claude | ✅ verified; Gemini/Cursor configured but not verifiable (not installed) |
| Failure classification, lock, snapshot, contract/stale checks, successor choice | ✅ `tools/agent-supervisor`, 16 simulated-failure tests |
| Launch successor in same worktree | ⚠️ `--launch` runs it as an **external CLI, not a Shep-registered worker** |
| Suspend Shep retries before takeover | ❌ manual (`shep feat status`, `shep agent stop <run>`); no exclusion against Shep retries → automatic handover is **not** enabled |
| Per-feature routing to Codex via Shep | ❌ only by changing the global agent when no other feature is running |
| Coordinator replacement | ❌ **manual** (steps below) |
| A Codex task executed *through Shep* | ⏳ not run yet: switching the global agent while this feature runs would violate the no-concurrent-global-change rule. Exact steps below. |

## Verify a Codex task through Shep (run once this feature is idle)
```sh
shep feat ls                                  # confirm no running feature
shep settings agent --agent codex --auth session   # verify accepted value with `shep settings agent` wizard first
shep feat new "$(cat docs/tasks/002-shep-codex-probe.md)" --pending
shep feat start <id> && shep feat wait <id>
# then in the new worktree: cat WORKTREE_STATE.md; git log -3; ls .env.worktree; supervisor verify
shep settings agent --agent claude-code --auth session   # restore coordinator default
```

## Supervisor usage
```sh
S="uv run --no-project --python 3.15 python tools/agent-supervisor/supervisor.py"
codex exec --json -C "$PWD" -s workspace-write "<task>" > /tmp/ev.jsonl 2> /tmp/err.txt; rc=$?   # logs OUTSIDE the worktree
$S classify --exit-code $rc --events /tmp/ev.jsonl --stderr /tmp/err.txt     # ok|quota|auth|transient|implementation
$S verify --no-db                                                           # state vs disk/contract/base SHA
$S handover --from-agent codex --task docs/tasks/<id>.md --exit-code $rc --events /tmp/ev.jsonl --stderr /tmp/err.txt
```
Rules it enforces: patterns only from structured error events/stderr (quoted "rate limit" in code/output is ignored);
transient → bounded backoff (3 tries, honours retry-after); refuses if the outgoing PID is alive or the
`.agent-supervisor/worktree.lock` is held; snapshots status, staged/unstaged binary patches, untracked list,
contract hashes and `alembic current` before anything else; never resets, cleans or deletes; only selects workers
on subscription billing (never API-key billing); if none available → `pause_all_unavailable` with records in
`.agent-supervisor/handovers/`. Preference: codex → gemini → claude.

## Manual coordinator replacement (until a tested coordinator supervisor exists)
1. Confirm the old coordinator session is closed (no `claude`/`codex` process in the repo: `pgrep -fl "claude|codex"`).
2. Open the next coordinator (Claude → Codex → Gemini) in the main repo; give it `docs/STATE.md` + this file.
3. It runs `shep feat ls` / `shep feat status <id>` for every feature, then `supervisor.py verify` per worktree.
4. Never two coordinators at once; never change the global Shep agent while a feature is running.

## Git remote (personal GitHub)
`origin` = `git@github.com-personal:FcoGuadarrama/cleaning-platform.git` (verified 2026-11-03: repo exists, empty).
- Use the `github.com-personal` SSH alias from `~/.ssh/config`; plain `git@github.com` is rejected (no default key),
  and `github.com-trabajo` is the work account. Never point this repo at the work account or org.
- `FcoGuadarrama-personal/cleaning-platform` does not exist (`api.github.com` → 404); use the owner above.
- Check access without writing: `git ls-remote origin` (no output + exit 0 = reachable and empty).
- Pushing is an owner-approved step (AGENTS.md). A push to `main` triggers `ci` and then `deploy` (staging),
  which fails until the repository secrets and `production` environment are configured.

## Parallelism
One active worker until a Shep-routed Codex task passes. Then parallelise only independent tasks; one owner per
worktree; contract (`docs/contracts`) and migration (`apps/api/alembic/versions`) changes are serialised.
