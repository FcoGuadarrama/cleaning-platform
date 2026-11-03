"""Atomic writes for WORKTREE_STATE.md and supervisor records.

Usage: python tools/agent-supervisor/statefile.py <target> < new_content
"""

from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path


def atomic_write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=f".{path.name}.", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write(content)
            fh.flush()
            os.fsync(fh.fileno())
        os.replace(tmp, path)
    except BaseException:
        Path(tmp).unlink(missing_ok=True)
        raise


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("usage: statefile.py <target-path>  (content on stdin)")
    atomic_write(Path(sys.argv[1]), sys.stdin.read())
