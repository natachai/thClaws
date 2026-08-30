"""Sequential Trip Generation runs from an explicit copied-workspace manifest.

Malformed manifests/requests fail preflight before any run. Calculation failures
are recorded per year and do not prevent subsequent years from running. This is
not a workflow scheduler and does not change model parameters or algorithms.
"""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path
from typing import Any
import uuid

from . import runner


class BatchError(runner.RequestError):
    """Invalid batch configuration or unsafe batch output."""


def _unique_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise BatchError(f"Duplicate JSON field: {key}")
        result[key] = value
    return result


def _invalid_constant(value: str) -> None:
    raise BatchError(f"Non-finite JSON number is not allowed: {value}")


def _read_json(path: Path) -> tuple[Any, str]:
    contents = path.read_bytes()
    return (
        json.loads(contents.decode("utf-8-sig"), object_pairs_hook=_unique_object, parse_constant=_invalid_constant),
        hashlib.sha256(contents).hexdigest(),
    )


def _runs_root(workspace: Path) -> Path:
    path = workspace / "runs"
    if path.is_symlink() or path.resolve() != path or (path.exists() and not path.is_dir()):
        raise BatchError("runs must be a real directory directly inside the workspace, not a link/junction.")
    return path


def _validate_request(request: Any, year: int, workspace: Path) -> None:
    if not isinstance(request, dict) or set(request) != {"schemaVersion", "actionId", "parameters", "inputs"}:
        raise BatchError(f"Year {year}: request fields must be schemaVersion, actionId, parameters and inputs only.")
    if type(request["schemaVersion"]) is not int or request["schemaVersion"] != 1:
        raise BatchError(f"Year {year}: only request schemaVersion 1 is supported.")
    if request["actionId"] != runner.ACTION_ID:
        raise BatchError(f"Year {year}: request actionId must be {runner.ACTION_ID}.")
    parameters = request["parameters"]
    if (
        not isinstance(parameters, dict) or set(parameters) != {"year"}
        or type(parameters["year"]) is not int or parameters["year"] != year
    ):
        raise BatchError(f"Year {year}: request parameters must contain only the matching integer year.")
    inputs = request["inputs"]
    if not isinstance(inputs, dict):
        raise BatchError(f"Year {year}: inputs must be an object of named files.")
    missing = set(runner.REQUIRED_INPUTS) - set(inputs)
    unknown = set(inputs) - set(runner.REQUIRED_INPUTS + runner.OPTIONAL_INPUTS)
    if missing or unknown:
        raise BatchError(f"Year {year}: invalid input keys: missing={sorted(missing)}, unknown={sorted(unknown)}")
    for value in inputs.values():
        runner._relative_file(workspace, value)


def _preflight(batch_file: Path, workspace: Path) -> tuple[Path, str, list[dict[str, Any]]]:
    path = batch_file if batch_file.is_absolute() else workspace / batch_file
    path = path.resolve(strict=True)
    if not path.is_relative_to(workspace) or not path.is_file():
        raise BatchError("Batch manifest must be a file inside the copied workspace.")
    manifest, manifest_hash = _read_json(path)
    if not isinstance(manifest, dict) or set(manifest) != {"schemaVersion", "actionId", "years"}:
        raise BatchError("Batch fields must be schemaVersion, actionId and years only.")
    if type(manifest["schemaVersion"]) is not int or manifest["schemaVersion"] != 1:
        raise BatchError("Only batch schemaVersion 1 is supported.")
    if manifest["actionId"] != runner.ACTION_ID:
        raise BatchError(f"Only {runner.ACTION_ID} batches are supported.")
    if not isinstance(manifest["years"], list) or not manifest["years"]:
        raise BatchError("years must be a nonempty list of year/request objects.")
    prepared: list[dict[str, Any]] = []
    seen: set[int] = set()
    for entry in manifest["years"]:
        if not isinstance(entry, dict) or set(entry) != {"year", "request"}:
            raise BatchError("Each year entry must contain year and request only.")
        year = entry["year"]
        if type(year) is not int or year <= 0 or year in seen:
            raise BatchError("Batch years must be unique positive integers, not booleans.")
        seen.add(year)
        request_path = runner._relative_file(workspace, entry["request"])
        request, request_hash = _read_json(request_path)
        _validate_request(request, year, workspace)
        prepared.append({
            "year": year, "request": request, "requestPath": request_path,
            "requestSha256": request_hash,
        })
    _runs_root(workspace)
    return path, manifest_hash, prepared


def _nonnegative_number(value: Any, label: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0:
        raise BatchError(f"Invalid {label} in completed run: expected a finite nonnegative number.")
    return float(value)


def _count(value: Any, label: str) -> int:
    if type(value) is not int or value < 0:
        raise BatchError(f"Invalid {label} in completed run: expected a nonnegative integer.")
    return value


def _segment_total(summary: dict[str, Any], key: str) -> float:
    values = summary.get(key)
    if not isinstance(values, dict) or not values:
        raise BatchError(f"Completed run is missing {key}.")
    total = math.fsum(_nonnegative_number(value, key) for value in values.values())
    return round(_nonnegative_number(total, key), 6)


def _completed_entry(result: Any, year: int, workspace: Path) -> dict[str, Any]:
    if not isinstance(result, dict) or result.get("status") != "completed":
        raise BatchError("Individual runner did not return a completed result.")
    if result.get("actionId") != runner.ACTION_ID or result.get("parameters") != {"year": year}:
        raise BatchError("Individual runner returned a different action/year.")
    run_id = result.get("runId")
    if (
        not isinstance(run_id, str) or not run_id.startswith("trip-generation-")
        or any(not (character.isascii() and (character.isalnum() or character in "-_")) for character in run_id)
    ):
        raise BatchError("Individual runner returned an invalid runId.")
    run_directory = _runs_root(workspace) / run_id
    manifest = runner._relative_file(workspace, f"runs/{run_id}/result.json")
    if manifest.parent != run_directory:
        raise BatchError("Individual result directory was redirected.")
    saved_result, _ = _read_json(manifest)
    if saved_result != result:
        raise BatchError("Individual result manifest differs from the returned result.")
    artifacts = result.get("artifacts")
    if not isinstance(artifacts, list):
        raise BatchError("Completed result has no artifacts list.")
    qa_files: list[Path] = []
    references: list[dict[str, Any]] = []
    for artifact in artifacts:
        if not isinstance(artifact, dict):
            raise BatchError("Invalid artifact in completed result.")
        path = runner._relative_file(workspace, artifact.get("path"))
        if path.parent != run_directory:
            raise BatchError("Result artifact must be inside its individual run directory.")
        if artifact.get("sha256") is not None and runner._sha256(path) != artifact["sha256"]:
            raise BatchError("Result artifact bytes differ from the manifest hash.")
        references.append({key: artifact[key] for key in ("id", "path", "format") if key in artifact})
        if artifact.get("id") == "qa":
            if artifact.get("format") != "json":
                raise BatchError("QA artifact must be JSON.")
            qa_files.append(path)
    if len(qa_files) != 1:
        raise BatchError("Completed result must contain exactly one QA artifact.")
    qa, _ = _read_json(qa_files[0])
    summary = result.get("summary")
    if not isinstance(summary, dict) or not isinstance(qa, dict):
        raise BatchError("Completed result summary and QA must be JSON objects.")
    cross_classification = summary.get("cross_classification")
    if not isinstance(cross_classification, dict):
        raise BatchError("Completed result is missing Furness diagnostics.")
    warnings = result.get("warnings", [])
    if not isinstance(warnings, list) or any(not isinstance(warning, str) for warning in warnings):
        raise BatchError("Completed result warnings must be a list of strings.")
    return {
        "status": "completed", "runId": run_id,
        "resultManifest": manifest.relative_to(workspace).as_posix(),
        "zoneCount": _count(summary.get("zone_count"), "zone count"),
        "totalProductions": _segment_total(summary, "production_totals"),
        "totalAttractions": _segment_total(summary, "attraction_balanced_totals"),
        "ageMismatchCount": _count(qa.get("age_total_mismatch_count_over_5pct"), "age mismatch count"),
        "ownershipMismatchCount": _count(qa.get("ownership_total_mismatch_count_over_5pct"), "ownership mismatch count"),
        "furnessMaxColumnResidual": _nonnegative_number(cross_classification.get("max_column_residual"), "Furness column residual"),
        "warnings": warnings, "errors": [], "artifacts": references,
    }


def _markdown(summary: dict[str, Any]) -> str:
    def escape(value: Any) -> str:
        return str(value).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("|", "\\|").replace("\r", " ").replace("\n", " ")

    lines = [
        "# Trip Generation batch summary", "",
        f"Status: {summary['status']}", "",
        "Scientific status: experimental legacy reproduction; not calibration or validation against Cube.", "",
        f"Completed: {summary['completedYearCount']} / {summary['requestedYearCount']}; failed: {summary['failedYearCount']}.", "",
        "| Year | Status | Zones | Productions | Balanced attractions | Age mismatch >5% | Ownership mismatch >5% | Max Furness column residual | Warnings |",
        "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ]
    for entry in summary["years"]:
        metrics = [
            entry["year"], entry["status"], entry.get("zoneCount", "—"),
            entry.get("totalProductions", "—"), entry.get("totalAttractions", "—"),
            entry.get("ageMismatchCount", "—"), entry.get("ownershipMismatchCount", "—"),
            entry.get("furnessMaxColumnResidual", "—"), len(entry["warnings"]),
        ]
        lines.append("| " + " | ".join(escape(value) for value in metrics) + " |")
    for entry in summary["years"]:
        lines += ["", f"## {entry['year']}", "", f"Request: {escape(entry['request'])}"]
        if entry.get("resultManifest"):
            lines += ["", f"Result manifest: {escape(entry['resultManifest'])}"]
        for label, messages in (("Warning", entry["warnings"]), ("Error", entry["errors"])):
            if messages:
                lines += [""] + [f"- {label}: {escape(message)}" for message in messages]
    return "\n".join(lines) + "\n"


def run_batch(batch_file: Path, *, workspace: Path) -> dict[str, Any]:
    """Run validated year requests sequentially and publish an immutable summary."""
    workspace = workspace.resolve(strict=True)
    if not workspace.is_dir():
        raise BatchError("Workspace must be an existing directory.")
    manifest, manifest_hash, prepared = _preflight(batch_file, workspace)
    runs_root = _runs_root(workspace)
    runs_root.mkdir(exist_ok=True)
    _runs_root(workspace)
    batch_id = f"trip-generation-batch-{uuid.uuid4().hex}"
    output_directory = runs_root / batch_id
    output_directory.mkdir(exist_ok=False)
    entries: list[dict[str, Any]] = []
    for item in prepared:
        entry: dict[str, Any] = {
            "year": item["year"], "request": item["requestPath"].relative_to(workspace).as_posix(),
            "requestSha256": item["requestSha256"], "status": "failed",
            "runId": None, "resultManifest": None, "warnings": [], "errors": [], "artifacts": [],
        }
        try:
            if runner._sha256(item["requestPath"]) != item["requestSha256"]:
                raise BatchError("Request file changed after preflight; this year was not run.")
            result = runner.run_request(item["request"], workspace=workspace)
            entry.update(_completed_entry(result, item["year"], workspace))
        except Exception as exc:
            # One failure must not replace inputs/parameters or stop later years.
            entry["errors"] = [f"{type(exc).__name__}: {exc}"]
        entries.append(entry)
    completed = sum(entry["status"] == "completed" for entry in entries)
    summary = {
        "schemaVersion": 1, "actionId": runner.ACTION_ID, "batchId": batch_id,
        "status": "completed" if completed == len(entries) else "completed_with_errors",
        "scientificStatus": "experimental-legacy-reproduction-not-calibration",
        "batchManifest": manifest.relative_to(workspace).as_posix(), "batchManifestSha256": manifest_hash,
        "requestedYearCount": len(entries), "completedYearCount": completed, "failedYearCount": len(entries) - completed,
        "summaryJson": (output_directory / "summary.json").relative_to(workspace).as_posix(),
        "summaryMarkdown": (output_directory / "summary.md").relative_to(workspace).as_posix(),
        "years": entries,
    }
    # Recheck the destination after the individual runs, before summary writes.
    _runs_root(workspace)
    if output_directory.resolve() != output_directory:
        raise BatchError("Batch summary directory was redirected.")
    with (output_directory / "summary.md").open("x", encoding="utf-8", newline="\n") as handle:
        handle.write(_markdown(summary))
    pending = output_directory / ".summary.pending.json"
    runner._write_json(pending, summary)
    # Completion marker LAST; interrupted writes retain evidence, not completion.
    pending.rename(output_directory / "summary.json")
    return summary
