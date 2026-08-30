"""Verify saved all-years TG artifacts, copied inputs and 2032 regression.

Reads only the development workspace. Never accesses the original model.
Writes a new verification report beside an existing batch summary.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
from pathlib import Path
import sys
import uuid

ENGINE_ROOT = Path(__file__).resolve().parents[1]
sys.dont_write_bytecode = True
sys.path.insert(0, str(ENGINE_ROOT / "src"))

from thclaws_transport.runner import ACTION_ID, _relative_file, _sha256, _write_json

YEARS = [2022, 2027, 2032, 2037, 2042, 2047, 2052, 2057]
EXPECTED_ROWS = {"productions": 1778, "attractions": 1778, "zone_results": 1778, "segments": 28448, "age_segments": 85344}
TEXT_FIELDS = {"AREA_TYPE", "MRT_CLASS", "purpose", "ownership"}


def check(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def verify(summary_reference: str) -> dict:
    summary_path = _relative_file(ENGINE_ROOT, summary_reference)
    check(summary_path.parent.parent == ENGINE_ROOT / "runs", "Summary must be in a run directory.")
    summary = load(summary_path)
    check(summary["status"] == "completed", "Batch has incomplete/failed years; inspect summary first.")
    entries = summary["years"]
    check([entry["year"] for entry in entries] == YEARS, "Expected all eight years in model order.")
    fixture_root = ENGINE_ROOT / "local-fixtures" / "trip-generation-all-years"
    copy_manifest = load(fixture_root / "copy-manifest.json")
    check(copy_manifest["years"] == YEARS and len(copy_manifest["copies"]) == 21, "Unexpected copied-input inventory")
    check(len(copy_manifest["generatedFiles"]) == 9, "Expected eight requests plus batch manifest")
    for record in copy_manifest["copies"]:
        check(_sha256(_relative_file(ENGINE_ROOT, record["destination"])) == record["sha256"].lower(), "Copied input changed: " + record["destination"])
    for record in copy_manifest["generatedFiles"]:
        check(_sha256(_relative_file(ENGINE_ROOT, record["path"])) == record["sha256"].lower(), "Copied request changed: " + record["path"])
    run_ids = set()
    results = []
    for entry in entries:
        year = entry["year"]
        check(entry["status"] == "completed", f"Year {year} not completed")
        result_path = _relative_file(ENGINE_ROOT, entry["resultManifest"])
        result = load(result_path)
        check(result["parameters"]["year"] == year and result["actionId"] == ACTION_ID and result["status"] == "completed", f"Result identity mismatch: {year}")
        check(result["runId"] == entry["runId"] and result["runId"] not in run_ids, "Run directory reused or mismatched")
        run_ids.add(result["runId"])
        request = load(fixture_root / "requests" / f"{year}.json")
        check(set(result["inputs"]) == set(request["inputs"]), "Result input key mismatch")
        for key, reference in request["inputs"].items():
            check(result["inputs"][key]["path"] == reference, f"Wrong input used: {year}/{key}")
            check(result["inputs"][key]["sha256"] == _sha256(_relative_file(ENGINE_ROOT, reference)), f"Input provenance mismatch: {year}/{key}")
        artifacts = {item["portId"]: item for item in result["artifacts"]}
        check(len(result["artifacts"]) == 7 and set(artifacts) == set(EXPECTED_ROWS) | {"totals", "qa"}, "Missing or duplicate output artifact")
        production_columns = {}
        attraction_columns = {}
        row_counts = {}
        golden_matches = []
        for port_id, artifact in artifacts.items():
            path = _relative_file(ENGINE_ROOT, artifact["path"])
            check(path.parent == result_path.parent, f"Artifact escaped its own run: {year}/{port_id}")
            check(_sha256(path) == artifact["sha256"] and path.stat().st_size == artifact["bytes"], f"Artifact hash/size mismatch: {year}/{port_id}")
            if port_id not in EXPECTED_ROWS:
                continue
            row_count = 0
            zones = set()
            with path.open(encoding="utf-8", newline="") as handle:
                reader = csv.DictReader(handle)
                check(reader.fieldnames == artifact["fields"], f"CSV field order mismatch: {year}/{port_id}")
                sums = {field: 0.0 for field in reader.fieldnames if field != "ZONE"}
                for row in reader:
                    row_count += 1
                    check(None not in row and None not in row.values(), f"Malformed row: {year}/{port_id}/{row_count}")
                    zones.add(row["ZONE"])
                    for field, value in row.items():
                        if field not in TEXT_FIELDS:
                            number = float(value)
                            check(math.isfinite(number) and number >= 0, f"Invalid output number: {year}/{port_id}/{row_count}/{field}")
                            if port_id in ("productions", "attractions") and field != "ZONE":
                                sums[field] += number
            check(row_count == EXPECTED_ROWS[port_id] == artifact["rows"], f"Unexpected row count: {year}/{port_id}")
            check(len(zones) == 1778, f"Unexpected zone coverage: {year}/{port_id}")
            row_counts[port_id] = row_count
            if port_id == "productions":
                production_columns = sums
            elif port_id == "attractions":
                attraction_columns = sums
            if year == 2032:
                golden = ENGINE_ROOT / "local-fixtures" / "trip-generation-2032" / "expected" / path.name
                check(_sha256(path) == _sha256(golden), "2032 golden differs: " + path.name)
                golden_matches.append(path.name)
        totals = load(_relative_file(ENGINE_ROOT, artifacts["totals"]["path"]))
        qa = load(_relative_file(ENGINE_ROOT, artifacts["qa"]["path"]))
        check(totals == result["summary"], f"Summary/totals mismatch: {year}")
        max_balance_delta = 0.0
        for segment, production in totals["production_totals"].items():
            attraction = totals["attraction_balanced_totals"][segment]
            delta = abs(production - attraction)
            max_balance_delta = max(max_balance_delta, delta)
            check(delta <= 0.000002, f"Unexpected summary P/A imbalance: {year}/{segment}")
            purpose, ownership = segment.split("_", 1)
            exported_ownership = {"VEH0": "OVEH", "CAR": "PC"}.get(ownership, ownership)
            suffix = f"{purpose}_{exported_ownership}"
            # 1,778 per-zone values are rounded to 6dp independently of totals.
            check(abs(production_columns[f"P_{suffix}"] - production) <= 0.001, f"Production CSV sum mismatch: {year}/{segment}")
            check(abs(attraction_columns[f"A_{suffix}"] - attraction) <= 0.001, f"Attraction CSV sum mismatch: {year}/{segment}")
        if year == 2032:
            expected = ENGINE_ROOT / "local-fixtures" / "trip-generation-2032" / "expected"
            check(totals == load(expected / "trip_generation_totals.json"), "2032 golden totals mismatch")
            check(qa == load(expected / "trip_generation_qa.json"), "2032 golden QA mismatch")
        results.append({"year": year, "status": "verified", "runId": result["runId"], "rows": row_counts, "artifactsVerified": 7, "maxSummaryBalanceDelta": max_balance_delta, "goldenCsvMatches": golden_matches, "ageMismatchCount": qa["age_total_mismatch_count_over_5pct"], "ownershipMismatchCount": qa["ownership_total_mismatch_count_over_5pct"], "furnessMaxColumnResidual": totals["cross_classification"]["max_column_residual"]})
    return {"status": "verified", "batchSummary": summary_reference, "copiedInputsVerified": 21, "artifactsVerified": 56, "csvTablesVerified": 40, "years": results, "scope": "All-years artifact/provenance/finite-value/accounting checks; historical golden regression only for 2032. Not scientific calibration."}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, allow_abbrev=False)
    parser.add_argument("--summary", required=True, help="Workspace-relative batch summary.json")
    args = parser.parse_args()
    try:
        report = verify(args.summary)
        summary_path = _relative_file(ENGINE_ROOT, args.summary)
        report_path = summary_path.parent / f"verification-{uuid.uuid4().hex}.json"
        _write_json(report_path, report)
        print(json.dumps({"status": "verified", "years": len(report["years"]), "artifacts": report["artifactsVerified"], "csvTables": report["csvTablesVerified"], "report": report_path.relative_to(ENGINE_ROOT).as_posix()}))
    except (OSError, ValueError, KeyError) as error:
        print(json.dumps({"status": "failed", "error": str(error)}))
        raise SystemExit(1)
