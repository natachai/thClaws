from __future__ import annotations

from contextlib import redirect_stderr, redirect_stdout
import importlib.util
import io
import json
from pathlib import Path
import shutil
import subprocess
import sys
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
LAUNCHER = ROOT / "scripts" / "desktop_run.py"
spec = importlib.util.spec_from_file_location("desktop_run_tests_launcher", LAUNCHER)
desktop = importlib.util.module_from_spec(spec)
spec.loader.exec_module(desktop)


class DesktopJobTests(unittest.TestCase):
    def setUp(self):
        self.temporary = TemporaryDirectory(prefix="thclaws-desktop-job-test-")
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name).resolve()
        self.job = self.root / "job"
        self.job.mkdir()
        self.request = self.job / "request.json"
        self.request.write_text('{"schemaVersion": 99}', encoding="utf-8")

    def invoke(self, workspace=None, request=None):
        stream = io.StringIO()
        with redirect_stdout(stream):
            result = desktop.main(["--workspace", str(workspace or self.job), "--request", str(request or self.request)])
        return result, json.loads(stream.getvalue())

    def test_invalid_request_returns_json_failure_without_outputs(self):
        code, result = self.invoke()
        self.assertEqual(code, 1)
        self.assertEqual(result["status"], "failed")
        self.assertFalse((self.job / "runs").exists())

    def test_relative_workspace_and_request_rejected(self):
        for workspace, request in ((Path("relative-job"), self.request), (self.job, Path("request.json"))):
            with self.subTest(workspace=workspace, request=request), patch.object(desktop, "run_request") as run:
                code, result = self.invoke(workspace, request)
                self.assertEqual(code, 1)
                self.assertIn("absolute", result["error"])
                run.assert_not_called()

    def test_request_outside_job_is_rejected(self):
        outside = self.root / "outside.json"
        outside.write_text("{}", encoding="utf-8")
        with patch.object(desktop, "run_request") as run:
            code, result = self.invoke(request=outside)
            self.assertEqual(code, 1)
            self.assertIn("inside", result["error"])
            run.assert_not_called()

    def test_root_workspace_rejected(self):
        code, result = self.invoke(workspace=Path(self.job.anchor))
        self.assertEqual(code, 1)
        self.assertIn("drive root", result["error"])

    def test_parent_traversal_rejected(self):
        code, result = self.invoke(workspace=self.job / ".." / "job")
        self.assertEqual(code, 1)
        self.assertIn("traversal", result["error"])

    def test_duplicate_nonfinite_and_oversized_json_rejected(self):
        for contents in ('{"year":2032,"year":2022}', '{"year":NaN}', " " * (desktop.MAX_REQUEST_BYTES + 1)):
            with self.subTest(contents=contents[:50]), patch.object(desktop, "run_request") as run:
                self.request.write_text(contents, encoding="utf-8")
                self.assertEqual(self.invoke()[0], 1)
                run.assert_not_called()

    def test_abbreviated_flag_rejected_before_execution(self):
        with patch.object(desktop, "run_request") as run, redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit) as error:
                desktop.main(["--work", str(self.job), "--request", str(self.request)])
            self.assertEqual(error.exception.code, 2)
            run.assert_not_called()

    def test_success_result_is_not_replaced_with_demo(self):
        self.request.write_text("{}", encoding="utf-8")
        expected = {"status": "completed", "runId": "actual-engine-job", "warnings": ["retain"]}
        with patch.object(desktop, "run_request", return_value=expected) as run:
            code, result = self.invoke()
            self.assertEqual(code, 0)
            self.assertEqual(result, expected)
            run.assert_called_once_with({}, workspace=self.job)

    @unittest.skipUnless((ROOT / "local-fixtures" / "trip-generation-2032" / "inputs").is_dir(), "Local copied fixture unavailable")
    def test_real_isolated_desktop_job_preserves_copied_golden_output(self):
        job = self.root / "desktop job ทดสอบ"
        inputs_dir = job / "inputs"
        inputs_dir.mkdir(parents=True)
        request = json.loads((ROOT / "examples" / "trip-generation-2032.json").read_text(encoding="utf-8"))
        for key, relative in request["inputs"].items():
            source = ROOT / relative
            shutil.copyfile(source, inputs_dir / source.name)
            request["inputs"][key] = f"inputs/{source.name}"
        request_file = job / "request.json"
        request_file.write_text(json.dumps(request), encoding="utf-8")
        completed = subprocess.run([sys.executable, "-I", "-B", str(LAUNCHER), "--workspace", str(job), "--request", str(request_file)], cwd=ROOT, capture_output=True, timeout=30)
        self.assertEqual(completed.returncode, 0, completed.stderr.decode("utf-8", errors="replace"))
        result = json.loads(completed.stdout.decode("utf-8"))
        self.assertEqual(result["status"], "completed")
        self.assertEqual(result["summary"]["zone_count"], 1778)
        self.assertEqual(len(result["artifacts"]), 7)
        for artifact in result["artifacts"]:
            output = job / artifact["path"]
            self.assertTrue(output.resolve().is_relative_to(job))
            if artifact["format"] == "csv":
                expected = ROOT / "local-fixtures" / "trip-generation-2032" / "expected" / output.name
                self.assertEqual(output.read_bytes(), expected.read_bytes())
        self.assertEqual(list(job.rglob("__pycache__")), [])


if __name__ == "__main__":
    unittest.main()
