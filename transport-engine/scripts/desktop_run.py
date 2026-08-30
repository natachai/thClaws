"""Trusted single-action entrypoint used by the THClaws Rust desktop bridge.

Rust creates a fresh workspace-local job and copies authorized inputs there.
This launcher never discovers an eBUMpy workspace or executes user scripts.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

ENGINE_ROOT = Path(__file__).resolve().parents[1]
MAX_REQUEST_BYTES = 1024 * 1024
sys.dont_write_bytecode = True
sys.path.insert(0, str(ENGINE_ROOT / "src"))

from thclaws_transport.runner import run_request


def _object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"Duplicate request field: {key}")
        result[key] = value
    return result


def _invalid_constant(value):
    raise ValueError(f"Non-finite request number is not allowed: {value}")


def read_job(workspace: Path, request_file: Path):
    if not workspace.is_absolute() or not request_file.is_absolute():
        raise ValueError("Desktop workspace and request paths must be absolute.")
    if ".." in workspace.parts or ".." in request_file.parts:
        raise ValueError("Parent path traversal is not accepted for a desktop job.")
    resolved_workspace = workspace.resolve(strict=True)
    if not resolved_workspace.is_dir() or resolved_workspace == Path(resolved_workspace.anchor):
        raise ValueError("Desktop workspace must be a dedicated existing job directory, not a drive root.")
    resolved_request = request_file.resolve(strict=True)
    if resolved_request.parent != resolved_workspace or not resolved_request.is_file():
        raise ValueError("The desktop request must be a file directly inside its job workspace.")
    with resolved_request.open("rb") as handle:
        contents = handle.read(MAX_REQUEST_BYTES + 1)
    if len(contents) > MAX_REQUEST_BYTES:
        raise ValueError("Desktop request exceeds the 1 MiB limit.")
    request = json.loads(contents.decode("utf-8-sig"), object_pairs_hook=_object, parse_constant=_invalid_constant)
    return resolved_workspace, request


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, allow_abbrev=False)
    parser.add_argument("--workspace", type=Path, required=True)
    parser.add_argument("--request", type=Path, required=True)
    arguments = parser.parse_args(argv)
    try:
        if sys.version_info < (3, 11):
            raise ValueError("Trip Generation requires Python 3.11 or newer.")
        workspace, request = read_job(arguments.workspace, arguments.request)
        result = run_request(request, workspace=workspace)
        print(json.dumps(result, ensure_ascii=False, allow_nan=False))
        return 0
    except (OSError, UnicodeError, ValueError, KeyError, TypeError, OverflowError) as error:
        print(json.dumps({"schemaVersion": 1, "status": "failed", "error": str(error)}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    # The Rust bridge decodes bounded stdout/stderr as UTF-8 on every platform.
    sys.stdout.reconfigure(encoding="utf-8", errors="strict")
    sys.stderr.reconfigure(encoding="utf-8", errors="backslashreplace")
    raise SystemExit(main())
