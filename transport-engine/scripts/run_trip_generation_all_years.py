"""Run an explicit multi-year Trip Generation batch inside this copied engine."""

import argparse
import json
from pathlib import Path
import sys

ENGINE_ROOT = Path(__file__).resolve().parents[1]
sys.dont_write_bytecode = True
sys.path.insert(0, str(ENGINE_ROOT / "src"))

from thclaws_transport.batch import run_batch


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, allow_abbrev=False)
    parser.add_argument(
        "--batch", type=Path,
        default=ENGINE_ROOT / "local-fixtures" / "trip-generation-all-years" / "batch.json",
        help="Manifest inside transport-engine; request paths are relative to transport-engine",
    )
    args = parser.parse_args(argv)
    try:
        result = run_batch(args.batch, workspace=ENGINE_ROOT)
        print(json.dumps(result, ensure_ascii=False, allow_nan=False))
        return 0 if result["status"] == "completed" else 1
    except (ValueError, OSError, KeyError, TypeError) as exc:
        print(json.dumps({"schemaVersion": 1, "status": "failed", "error": str(exc)}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
