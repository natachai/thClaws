from __future__ import annotations

import copy
import hashlib
import io
import json
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from thclaws_transport.runner import ACTION_ID, REQUIRED_INPUTS, RequestError, TABLES, main, run_request


class RunnerTests(unittest.TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory(prefix="thclaws-tg-runner-test-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.request = {
            "schemaVersion": 1,
            "actionId": ACTION_ID,
            "parameters": {"year": 2032},
            "inputs": {},
        }
        for key in REQUIRED_INPUTS:
            path = self.root / f"{key}.data"
            path.write_text("mock input", encoding="utf-8")
            self.request["inputs"][key] = path.name
        rows = [{"ZONE": 1, "P_HBW_OVEH": 2.5}]
        self.calculation = SimpleNamespace(
            artifacts=SimpleNamespace(**{attribute: rows for _, _, attribute in TABLES}, summary={"zone_count": 1}),
            qa={"warnings": ["fixture"]}, warnings=["fixture"], counts={"demographic_rows": 1},
        )

    def assert_rejected_before_calculation(self, request, error=ValueError):
        with patch("thclaws_transport.runner.run") as calculate:
            with self.assertRaises(error):
                run_request(request, workspace=self.root)
            calculate.assert_not_called()
        self.assertFalse((self.root / "runs").exists())

    def test_unknown_action_rejected_without_outputs(self):
        self.request["actionId"] = "transport.modal_split"
        self.assert_rejected_before_calculation(self.request)

    def test_unknown_versions_and_fields_rejected(self):
        for version in (2, True, "1"):
            request = {**self.request, "schemaVersion": version}
            self.assert_rejected_before_calculation(request)
        self.assert_rejected_before_calculation({**self.request, "outputDir": "elsewhere"})

    def test_missing_unknown_inputs_and_parameters_rejected(self):
        for mutation in (
            lambda request: request["inputs"].pop("seed_csv"),
            lambda request: request["inputs"].update(typo="seed.csv"),
            lambda request: request["parameters"].update(year=True),
            lambda request: request["parameters"].update(coefficient=2),
        ):
            request = copy.deepcopy(self.request)
            mutation(request)
            self.assert_rejected_before_calculation(request)

    def test_absolute_parent_and_stream_paths_rejected(self):
        for value in ("../outside.csv", "sub/../../outside.csv", "C:/original/file.csv", "C:file.csv", "/tmp/file.csv", "\\\\host\\share\\file", "seed.csv:stream"):
            request = copy.deepcopy(self.request)
            request["inputs"]["seed_csv"] = value
            self.assert_rejected_before_calculation(request)

    def test_missing_input_is_rejected_without_writes(self):
        self.request["inputs"]["seed_csv"] = "not-found.csv"
        self.assert_rejected_before_calculation(self.request, FileNotFoundError)

    def test_existing_file_at_runs_is_not_overwritten(self):
        (self.root / "runs").write_text("keep me", encoding="utf-8")
        with patch("thclaws_transport.runner.run") as calculate:
            with self.assertRaises(RequestError):
                run_request(self.request, workspace=self.root)
            calculate.assert_not_called()
        self.assertEqual((self.root / "runs").read_text(), "keep me")

    def test_repeated_runs_create_distinct_artifacts_and_preserve_inputs(self):
        before = {path.name: path.read_bytes() for path in self.root.iterdir()}
        with patch("thclaws_transport.runner.run", return_value=self.calculation):
            first = run_request(self.request, workspace=self.root)
            second = run_request(self.request, workspace=self.root)
        self.assertNotEqual(first["runId"], second["runId"])
        self.assertEqual(first["warnings"], ["fixture"])
        self.assertEqual(first["scientificStatus"], "experimental-legacy-reproduction-not-calibration")
        self.assertEqual(len(first["artifacts"]), 7)
        for result in (first, second):
            saved = self.root / "runs" / result["runId"] / "result.json"
            self.assertEqual(json.loads(saved.read_text()), result)
            for artifact in result["artifacts"]:
                path = self.root / artifact["path"]
                self.assertTrue(path.resolve().is_relative_to(self.root))
                self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), artifact["sha256"])
        for filename, content in before.items():
            self.assertEqual((self.root / filename).read_bytes(), content)

    def test_input_change_during_calculation_is_not_published(self):
        def changed(*args, **kwargs):
            (self.root / self.request["inputs"]["seed_csv"]).write_text("changed", encoding="utf-8")
            return self.calculation
        with patch("thclaws_transport.runner.run", side_effect=changed):
            with self.assertRaisesRegex(RequestError, "changed during"):
                run_request(self.request, workspace=self.root)
        self.assertFalse((self.root / "runs").exists())

    def test_failure_never_publishes_completion_marker(self):
        with patch("thclaws_transport.runner.run", return_value=self.calculation), patch("thclaws_transport.runner._write_csv", side_effect=OSError("test disk failure")):
            with self.assertRaises(OSError):
                run_request(self.request, workspace=self.root)
        self.assertEqual(list((self.root / "runs").glob("*/result.json")), [])

    def test_cli_failure_is_json_and_nonzero(self):
        request = self.root / "request.json"
        request.write_text('{"schemaVersion": 99}', encoding="utf-8")
        stdout = io.StringIO()
        with redirect_stdout(stdout):
            code = main(["--workspace", str(self.root), "--request", str(request)])
        self.assertEqual(code, 1)
        self.assertEqual(json.loads(stdout.getvalue())["status"], "failed")
        self.assertFalse((self.root / "runs").exists())

    def test_abbreviated_workspace_cannot_override_fixed_launcher_root(self):
        for option in ("--work", "--workspa"):
            with patch("thclaws_transport.runner.run_request") as execute, redirect_stderr(io.StringIO()):
                with self.assertRaises(SystemExit) as error:
                    main(["--workspace", str(self.root), "--request", "unused.json", option, "elsewhere"])
                self.assertEqual(error.exception.code, 2)
                execute.assert_not_called()
        self.assertFalse((self.root / "runs").exists())


if __name__ == "__main__":
    unittest.main()
