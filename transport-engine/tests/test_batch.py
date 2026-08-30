"""Batch safety tests use temporary mock files, never real model calculations."""

from __future__ import annotations

import copy
from contextlib import redirect_stderr, redirect_stdout
import importlib.util
import io
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from thclaws_transport import batch, runner


ENGINE_ROOT = Path(__file__).resolve().parents[1]
_launcher_spec = importlib.util.spec_from_file_location(
    "batch_test_launcher", ENGINE_ROOT / "scripts" / "run_trip_generation_all_years.py",
)
launcher = importlib.util.module_from_spec(_launcher_spec)
_launcher_spec.loader.exec_module(launcher)


class BatchTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary_directory = TemporaryDirectory(prefix="thclaws-tg-batch-test-")
        self.addCleanup(self.temporary_directory.cleanup)
        self.temporary_root = Path(self.temporary_directory.name).resolve()
        self.root = self.temporary_root / "workspace"
        self.root.mkdir()
        (self.root / "requests").mkdir()
        (self.root / "data.txt").write_text("copied mock data", encoding="utf-8")
        self.requests = {}
        for year in (2032, 2037):
            request = {
                "schemaVersion": 1, "actionId": runner.ACTION_ID,
                "parameters": {"year": year},
                "inputs": {key: "data.txt" for key in runner.REQUIRED_INPUTS},
            }
            self.requests[year] = request
            self.write_request(year, request)
        self.manifest = {
            "schemaVersion": 1, "actionId": runner.ACTION_ID,
            "years": [{"year": year, "request": f"requests/{year}.json"} for year in (2032, 2037)],
        }
        self.manifest_path = self.root / "batch.json"
        self.write_manifest()
        self.mock_run_counter = 0

    def write_request(self, year, request) -> None:
        (self.root / "requests" / f"{year}.json").write_text(json.dumps(request), encoding="utf-8")

    def write_manifest(self, manifest=None) -> None:
        self.manifest_path.write_text(json.dumps(self.manifest if manifest is None else manifest), encoding="utf-8")

    def fake_run(self, request, *, workspace):
        self.assertEqual(workspace, self.root)
        year = request["parameters"]["year"]
        self.assertEqual(request, self.requests[year])
        self.mock_run_counter += 1
        run_id = f"trip-generation-{year}-{self.mock_run_counter}"
        output = workspace / "runs" / run_id
        output.mkdir()
        qa_path = output / "qa.json"
        qa_path.write_text(json.dumps({
            "age_total_mismatch_count_over_5pct": 1,
            "ownership_total_mismatch_count_over_5pct": 2,
        }), encoding="utf-8")
        result = {
            "status": "completed", "actionId": runner.ACTION_ID,
            "parameters": {"year": year}, "runId": run_id,
            "summary": {
                "zone_count": 1778,
                "production_totals": {"HBW": 2.5, "HBE": 3.25},
                "attraction_balanced_totals": {"HBW": 2.5, "HBE": 3.250001},
                "cross_classification": {"max_column_residual": 1.360739},
            },
            "warnings": ["known age issue | preserve <details>"],
            "artifacts": [{
                "id": "qa", "format": "json", "path": qa_path.relative_to(workspace).as_posix(),
                "sha256": runner._sha256(qa_path),
            }],
        }
        (output / "result.json").write_text(json.dumps(result), encoding="utf-8")
        return result

    def assert_preflight_rejected(self, manifest=None, error=ValueError) -> None:
        if manifest is not None:
            self.write_manifest(manifest)
        with patch.object(runner, "run_request") as execute:
            with self.assertRaises(error):
                batch.run_batch(self.manifest_path, workspace=self.root)
            execute.assert_not_called()
        self.assertFalse((self.root / "runs").exists())

    def test_summary_totals_qa_artifacts_and_input_bytes_are_preserved(self) -> None:
        before = {path: path.read_bytes() for path in self.root.rglob("*") if path.is_file()}
        with patch.object(runner, "run_request", side_effect=self.fake_run) as execute:
            result = batch.run_batch(Path("batch.json"), workspace=self.root)
        self.assertEqual(execute.call_count, 2)
        self.assertEqual(result["status"], "completed")
        self.assertEqual(result["completedYearCount"], 2)
        self.assertEqual(result["failedYearCount"], 0)
        self.assertEqual([entry["year"] for entry in result["years"]], [2032, 2037])
        for entry in result["years"]:
            self.assertEqual(entry["zoneCount"], 1778)
            self.assertEqual(entry["totalProductions"], 5.75)
            self.assertEqual(entry["totalAttractions"], 5.750001)
            self.assertEqual(entry["ageMismatchCount"], 1)
            self.assertEqual(entry["ownershipMismatchCount"], 2)
            self.assertEqual(entry["furnessMaxColumnResidual"], 1.360739)
            self.assertTrue((self.root / entry["resultManifest"]).is_file())
            self.assertTrue(entry["artifacts"])
        self.assertEqual(json.loads((self.root / result["summaryJson"]).read_text()), result)
        markdown = (self.root / result["summaryMarkdown"]).read_text(encoding="utf-8")
        self.assertIn("Ownership mismatch", markdown)
        self.assertIn("\\| preserve &lt;details&gt;", markdown)
        for path, original in before.items():
            self.assertEqual(path.read_bytes(), original)

    def test_one_failed_year_does_not_stop_next_year(self) -> None:
        def execute(request, **kwargs):
            if request["parameters"]["year"] == 2032:
                raise ValueError("missing valid model rows")
            return self.fake_run(request, **kwargs)
        with patch.object(runner, "run_request", side_effect=execute) as execute_mock:
            result = batch.run_batch(self.manifest_path, workspace=self.root)
        self.assertEqual(execute_mock.call_count, 2)
        self.assertEqual(result["status"], "completed_with_errors")
        self.assertEqual(result["completedYearCount"], 1)
        self.assertEqual(result["failedYearCount"], 1)
        self.assertEqual([entry["status"] for entry in result["years"]], ["failed", "completed"])
        self.assertIn("missing valid model rows", result["years"][0]["errors"][0])

    def test_invalid_manifest_shape_action_and_version_rejected(self) -> None:
        mutations = [
            [], {**self.manifest, "schemaVersion": True}, {**self.manifest, "schemaVersion": 2},
            {**self.manifest, "actionId": "transport.skim"}, {**self.manifest, "workspace": "other"},
            {**self.manifest, "years": []}, {**self.manifest, "years": {}},
            {**self.manifest, "years": [{"year": 2032, "request": "requests/2032.json", "outputDir": "other"}]},
        ]
        for manifest in mutations:
            with self.subTest(manifest=manifest):
                self.assert_preflight_rejected(manifest)

    def test_duplicate_noninteger_and_boolean_years_rejected(self) -> None:
        for invalid in (2032, True, False, 0, -1, 2037.5, "2037"):
            manifest = copy.deepcopy(self.manifest)
            manifest["years"][1]["year"] = invalid
            with self.subTest(year=invalid):
                self.assert_preflight_rejected(manifest)

    def test_later_request_year_mismatch_rejects_before_first_dispatch(self) -> None:
        self.write_request(2037, {**self.requests[2037], "parameters": {"year": 2042}})
        self.assert_preflight_rejected()

    def test_request_arguments_cannot_override_scope_or_action(self) -> None:
        request = self.requests[2037]
        mutations = [
            {**request, "workspace": "other"}, {**request, "outputDir": "other"},
            {**request, "command": "python original.py"}, {**request, "actionId": "transport.skim"},
            {**request, "schemaVersion": True}, {**request, "parameters": {"year": 2037, "coefficient": 5}},
            {**request, "inputs": {}}, {**request, "inputs": {**request["inputs"], "unknown": "data.txt"}},
        ]
        for mutated in mutations:
            self.write_request(2037, mutated)
            with self.subTest(request=mutated):
                self.assert_preflight_rejected()

    def test_unsafe_request_and_input_paths_rejected(self) -> None:
        for path in ("../outside.json", "C:/original.json", "C:original.json", "/outside.json", "\\\\server\\share\\file", "data.txt:stream"):
            manifest = copy.deepcopy(self.manifest)
            manifest["years"][1]["request"] = path
            with self.subTest(request_path=path):
                self.assert_preflight_rejected(manifest)
            self.write_manifest()
            request = copy.deepcopy(self.requests[2037])
            request["inputs"]["seed_csv"] = path
            self.write_request(2037, request)
            with self.subTest(input_path=path):
                self.assert_preflight_rejected()
            self.write_request(2037, self.requests[2037])

    def test_batch_manifest_outside_workspace_rejected(self) -> None:
        outside = self.temporary_root / "outside.json"
        outside.write_text(json.dumps(self.manifest), encoding="utf-8")
        with patch.object(runner, "run_request") as execute, self.assertRaises(batch.BatchError):
            batch.run_batch(outside, workspace=self.root)
        execute.assert_not_called()
        self.assertFalse((self.root / "runs").exists())

    def test_duplicate_json_fields_are_rejected(self) -> None:
        for target in (self.manifest_path, self.root / "requests" / "2037.json"):
            original = target.read_text()
            target.write_text(original[:-1] + ', "actionId": "transport.trip_generation"}', encoding="utf-8")
            with self.subTest(path=target):
                self.assert_preflight_rejected()
            target.write_text(original, encoding="utf-8")

    def test_existing_runs_file_and_redirected_directory_are_rejected(self) -> None:
        output = self.root / "runs"
        output.write_text("keep original", encoding="utf-8")
        with patch.object(runner, "run_request") as execute, self.assertRaises(batch.BatchError):
            batch.run_batch(self.manifest_path, workspace=self.root)
        execute.assert_not_called()
        self.assertEqual(output.read_text(), "keep original")

    def test_redirected_runs_resolution_rejected_before_dispatch(self) -> None:
        original_resolve = Path.resolve
        def resolve(path, *args, **kwargs):
            if path == self.root / "runs":
                return self.temporary_root / "elsewhere"
            return original_resolve(path, *args, **kwargs)
        with patch.object(Path, "resolve", resolve):
            self.assert_preflight_rejected()

    def test_fresh_batch_directories_never_overwrite_prior_summary(self) -> None:
        with patch.object(runner, "run_request", side_effect=self.fake_run):
            first = batch.run_batch(self.manifest_path, workspace=self.root)
            original = (self.root / first["summaryJson"]).read_bytes()
            second = batch.run_batch(self.manifest_path, workspace=self.root)
        self.assertNotEqual(first["batchId"], second["batchId"])
        self.assertEqual((self.root / first["summaryJson"]).read_bytes(), original)

    def test_forced_uuid_collision_rejects_without_overwriting_or_running(self) -> None:
        with patch.object(batch.uuid, "uuid4", return_value=SimpleNamespace(hex="fixed")):
            with patch.object(runner, "run_request", side_effect=self.fake_run):
                first = batch.run_batch(self.manifest_path, workspace=self.root)
            original = (self.root / first["summaryJson"]).read_bytes()
            with patch.object(runner, "run_request") as execute, self.assertRaises(FileExistsError):
                batch.run_batch(self.manifest_path, workspace=self.root)
            execute.assert_not_called()
        self.assertEqual((self.root / first["summaryJson"]).read_bytes(), original)

    def test_request_tamper_after_preflight_is_not_dispatched(self) -> None:
        def execute(request, **kwargs):
            result = self.fake_run(request, **kwargs)
            self.write_request(2037, {**self.requests[2037], "parameters": {"year": 2057}})
            return result
        with patch.object(runner, "run_request", side_effect=execute) as execute_mock:
            summary = batch.run_batch(self.manifest_path, workspace=self.root)
        self.assertEqual(execute_mock.call_count, 1)
        self.assertEqual(summary["status"], "completed_with_errors")
        self.assertIn("changed after preflight", summary["years"][1]["errors"][0])

    def test_summary_write_failure_never_publishes_completion_marker(self) -> None:
        with patch.object(runner, "run_request", side_effect=self.fake_run), patch.object(runner, "_write_json", side_effect=OSError("disk full")):
            with self.assertRaises(OSError):
                batch.run_batch(self.manifest_path, workspace=self.root)
        self.assertEqual(list((self.root / "runs").glob("trip-generation-batch-*/summary.json")), [])
        self.assertEqual(len(list((self.root / "runs").glob("*/result.json"))), 2)

    def test_escaped_artifact_path_marks_year_failed_without_reading_outside(self) -> None:
        def execute(request, **kwargs):
            result = self.fake_run(request, **kwargs)
            result["artifacts"][0]["path"] = "../outside.json"
            (self.root / "runs" / result["runId"] / "result.json").write_text(json.dumps(result), encoding="utf-8")
            return result
        with patch.object(runner, "run_request", side_effect=execute):
            result = batch.run_batch(self.manifest_path, workspace=self.root)
        self.assertEqual(result["failedYearCount"], 2)
        self.assertEqual(result["status"], "completed_with_errors")


class BatchLauncherTests(unittest.TestCase):
    def test_default_manifest_and_workspace_are_pinned(self) -> None:
        with patch.object(launcher, "run_batch", return_value={"status": "completed"}) as execute, redirect_stdout(io.StringIO()):
            self.assertEqual(launcher.main([]), 0)
        execute.assert_called_once_with(
            ENGINE_ROOT / "local-fixtures" / "trip-generation-all-years" / "batch.json",
            workspace=ENGINE_ROOT,
        )

    def test_scope_overrides_and_abbreviated_arguments_rejected(self) -> None:
        for option in ("--workspace", "--workspace=other", "--work", "--request", "--b"):
            with self.subTest(option=option), patch.object(launcher, "run_batch") as execute, redirect_stderr(io.StringIO()):
                with self.assertRaises(SystemExit) as exc:
                    launcher.main([option, "other"])
                self.assertEqual(exc.exception.code, 2)
                execute.assert_not_called()

    def test_partial_batch_and_preflight_failures_return_nonzero_json(self) -> None:
        for response in ({"status": "completed_with_errors"}, batch.BatchError("invalid manifest")):
            output = io.StringIO()
            with patch.object(launcher, "run_batch") as execute, redirect_stdout(output):
                if isinstance(response, Exception):
                    execute.side_effect = response
                else:
                    execute.return_value = response
                self.assertEqual(launcher.main([]), 1)
            self.assertIn(json.loads(output.getvalue())["status"], ("failed", "completed_with_errors"))


if __name__ == "__main__":
    unittest.main()
