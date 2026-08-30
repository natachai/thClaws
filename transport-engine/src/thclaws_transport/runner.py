"""Single-action local runner. Not yet the full workflow/JSONL IPC protocol.

Only explicit workspace-relative copied inputs are accepted. Outputs always go
to a new run directory; this module never dispatches an original eBUMpy CLI.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import sys
import uuid
from pathlib import Path, PureWindowsPath
from typing import Any

from . import __version__
from .generation import run

ACTION_ID = "transport.trip_generation"
REQUIRED_INPUTS = (
    "demographic_dbf", "attraction_dbf", "survey_trip_rate_csv", "seed_csv",
    "density_adjustment_csv", "year_adjustment_csv",
)
OPTIONAL_INPUTS = ("tour_trip_rate_csv",)
TABLES = (
    ("productions", "TGPRO_ALL.csv", "production_wide_rows"),
    ("attractions", "TGATT_ALL.csv", "attraction_wide_rows"),
    ("zone_results", "trip_generation_zone_results.csv", "zone_rows"),
    ("segments", "trip_generation_long.csv", "long_rows"),
    ("age_segments", "trip_generation_age_long.csv", "age_long_rows"),
)


class RequestError(ValueError):
    """Invalid action, version, parameter or bounded input path."""


def _relative_file(workspace: Path, value: Any) -> Path:
    if not isinstance(value, str) or not value.strip():
        raise RequestError("Each input must be a nonempty workspace-relative file path.")
    portable = PureWindowsPath(value)
    if portable.is_absolute() or portable.drive or portable.root or ".." in portable.parts or ":" in value:
        raise RequestError(f"Input path must stay relative to the workspace: {value}")
    path = (workspace / value.replace("\\", "/")).resolve(strict=True)
    if not path.is_relative_to(workspace) or not path.is_file():
        raise RequestError(f"Input is not a file inside the workspace: {value}")
    return path


def _sha256(path: Path) -> str:
    with path.open("rb") as handle:
        return hashlib.file_digest(handle, "sha256").hexdigest()


def _write_json(path: Path, value: Any) -> None:
    with path.open("x", encoding="utf-8", newline="\n") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2, allow_nan=False)
        handle.write("\n")


def _write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    if not rows:
        raise ValueError(f"Calculation produced an empty artifact: {path.name}")
    with path.open("x", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


def _artifact(workspace: Path, path: Path, port_id: str, format_name: str, **metadata: Any) -> dict[str, Any]:
    return {
        "id": port_id,
        "portId": port_id,
        "path": path.relative_to(workspace).as_posix(),
        "format": format_name,
        "bytes": path.stat().st_size,
        "sha256": _sha256(path),
        **metadata,
    }


def run_request(request: Any, *, workspace: Path) -> dict[str, Any]:
    """Validate, calculate and publish a fresh run. Never overwrite a prior run.

    ``workspace`` is an explicit trust boundary supplied by the local launcher;
    a future Rust bridge must authorize that root before calling this runner.
    """
    if not isinstance(request, dict):
        raise RequestError("Request must be a JSON object.")
    if set(request) != {"schemaVersion", "actionId", "parameters", "inputs"}:
        raise RequestError("Request fields must be schemaVersion, actionId, parameters and inputs only.")
    if type(request["schemaVersion"]) is not int or request["schemaVersion"] != 1:
        raise RequestError("Only local request schemaVersion 1 is supported.")
    if request["actionId"] != ACTION_ID:
        raise RequestError(f"Unsupported action: {request['actionId']!r}; only {ACTION_ID} is enabled.")
    parameters = request["parameters"]
    if not isinstance(parameters, dict) or set(parameters) != {"year"} or type(parameters["year"]) is not int:
        raise RequestError("parameters must contain one integer year; calibration overrides are not supported.")
    raw_inputs = request["inputs"]
    if not isinstance(raw_inputs, dict):
        raise RequestError("inputs must be an object of named input files.")
    missing = set(REQUIRED_INPUTS) - set(raw_inputs)
    unknown = set(raw_inputs) - set(REQUIRED_INPUTS + OPTIONAL_INPUTS)
    if missing or unknown:
        raise RequestError(f"Invalid input keys: missing={sorted(missing)}, unknown={sorted(unknown)}")
    workspace = workspace.resolve(strict=True)
    if not workspace.is_dir():
        raise RequestError("Workspace must be an existing directory.")
    inputs = {name: _relative_file(workspace, value) for name, value in raw_inputs.items()}
    input_hashes = {name: _sha256(path) for name, path in inputs.items()}
    # Reject a redirected output root before calculation or any filesystem write.
    runs_root = workspace / "runs"
    if runs_root.exists() and (not runs_root.is_dir() or runs_root.resolve() != runs_root):
        raise RequestError("runs must be a real directory directly inside the workspace, not a link/junction.")
    calculation = run(inputs, year=parameters["year"])
    if any(_sha256(path) != input_hashes[name] for name, path in inputs.items()):
        raise RequestError("Input bytes changed during calculation; no run was published.")
    runs_root.mkdir(exist_ok=True)
    if runs_root.resolve() != runs_root:
        raise RequestError("Run output root was redirected.")
    run_id = f"trip-generation-{uuid.uuid4().hex}"
    output_dir = runs_root / run_id
    output_dir.mkdir(exist_ok=False)
    artifacts: list[dict[str, Any]] = []
    try:
        for port_id, filename, attribute in TABLES:
            rows = getattr(calculation.artifacts, attribute)
            path = output_dir / filename
            _write_csv(path, rows)
            artifacts.append(_artifact(workspace, path, port_id, "csv", rows=len(rows), fields=list(rows[0])))
        for port_id, filename, content in (
            ("totals", "trip_generation_totals.json", calculation.artifacts.summary),
            ("qa", "trip_generation_qa.json", calculation.qa),
        ):
            path = output_dir / filename
            _write_json(path, content)
            artifacts.append(_artifact(workspace, path, port_id, "json"))
        result = {
            "schemaVersion": 1,
            "engineVersion": __version__,
            "actionId": ACTION_ID,
            "status": "completed",
            "scientificStatus": "experimental-legacy-reproduction-not-calibration",
            "runId": run_id,
            "parameters": parameters,
            "inputs": {name: {"path": path.relative_to(workspace).as_posix(), "sha256": input_hashes[name]} for name, path in inputs.items()},
            "counts": calculation.counts,
            "summary": calculation.artifacts.summary,
            "warnings": calculation.warnings,
            "artifacts": artifacts,
        }
        # Completion marker is written LAST. Partial runs never have this file.
        pending = output_dir / ".result.pending.json"
        _write_json(pending, result)
        pending.rename(output_dir / "result.json")
        return result
    except Exception:
        # Retain evidence in this new directory, never delete/replace older data.
        print(f"Run incomplete; retained partial artifacts at {output_dir}", file=sys.stderr)
        raise


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, allow_abbrev=False)
    parser.add_argument("--workspace", type=Path, required=True, help="Authorized copied-data workspace, never the original eBUMpy tree")
    parser.add_argument("--request", type=Path, required=True, help="Local single-action JSON request file")
    args = parser.parse_args(argv)
    try:
        request = json.loads(args.request.read_text(encoding="utf-8-sig"))
        result = run_request(request, workspace=args.workspace)
        print(json.dumps(result, ensure_ascii=False, allow_nan=False))
        return 0
    except (ValueError, OSError, KeyError) as exc:
        print(json.dumps({"schemaVersion": 1, "status": "failed", "error": str(exc)}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
