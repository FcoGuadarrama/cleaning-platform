"""Writes the authoritative contract deterministically: uv run python -m app.export_openapi"""

import json
from pathlib import Path

from app.main import create_app

OUT = Path(__file__).resolve().parents[3] / "docs" / "contracts" / "openapi.json"


def main() -> None:
    spec = create_app().openapi()
    OUT.write_text(json.dumps(spec, indent=2, sort_keys=True, ensure_ascii=False) + "\n")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
