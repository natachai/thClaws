"""Trip Generation regression tests, using destination copies only.

The optional 2032 fixture is intentionally local/untracked. Its input-summary
contains historical absolute paths; these tests never resolve or open them.
All mutation tests write to fresh temporary directories, never to the fixture.
"""

from __future__ import annotations

import csv
import hashlib
import json
from itertools import zip_longest
from pathlib import Path
import struct
import tempfile
import unittest

from thclaws_transport.generation import GenerationInputError, run
from thclaws_transport.generation.calculation import _furness_age_ownership


ENGINE_ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ENGINE_ROOT / "local-fixtures" / "trip-generation-2032"
INPUT_NAMES = {
    "demographic_dbf": "BTDS planning data 2032 V2.dbf",
    "attraction_dbf": "ATTR_MOD.DBF",
    "survey_trip_rate_csv": "Trip Rate_BTDS2565_SURVEY.csv",
    "tour_trip_rate_csv": "Trip Rate_BTDS2565_TOUR.csv",
    "seed_csv": "BTDS_SEED_CH_NEW.CSV",
    "density_adjustment_csv": "ADJTAB.CSV",
    "year_adjustment_csv": "BTDS_YEARADJUST.CSV",
}
GOLDEN_TABLES = {
    "trip_generation_zone_results.csv": ("zone_rows", 1778, 54),
    "trip_generation_long.csv": ("long_rows", 28448, 6),
    "trip_generation_age_long.csv": ("age_long_rows", 85344, 7),
    "TGPRO_ALL.csv": ("production_wide_rows", 1778, 17),
    "TGATT_ALL.csv": ("attraction_wide_rows", 1778, 17),
}
HAS_LOCAL_INPUTS = all((FIXTURE / "inputs" / name).is_file() for name in INPUT_NAMES.values())
HAS_LOCAL_GOLDENS = all(
    (FIXTURE / "expected" / name).is_file()
    for name in (*GOLDEN_TABLES, "trip_generation_totals.json", "trip_generation_qa.json")
)
LOCAL_FIXTURE_REASON = "Optional copied 2032 fixture is not present; no external source lookup is permitted"


def fixture_inputs() -> dict[str, Path]:
    return {key: FIXTURE / "inputs" / name for key, name in INPUT_NAMES.items()}


def fixture_snapshot() -> dict[str, tuple[int, int, str]]:
    """Detect file creation, content changes, and touches within the fixture."""
    return {
        str(path.relative_to(FIXTURE)): (
            path.stat().st_size,
            path.stat().st_mtime_ns,
            hashlib.sha256(path.read_bytes()).hexdigest(),
        )
        for path in FIXTURE.rglob("*")
        if path.is_file()
    }


class FurnessTests(unittest.TestCase):
    """The two original model tests, with only the package import changed."""

    def test_furness_matches_age_rows_and_ownership_columns(self) -> None:
        seed = [
            [1.0, 2.0, 3.0, 4.0, 5.0],
            [5.0, 4.0, 3.0, 2.0, 1.0],
            [2.0, 3.0, 4.0, 3.0, 2.0],
        ]
        age_margins = [30.0, 50.0, 20.0]
        ownership_margins = [10.0, 20.0, 30.0, 25.0, 15.0]

        matrix = _furness_age_ownership(seed, age_margins, ownership_margins)

        for actual, expected in zip([sum(row) for row in matrix], age_margins):
            self.assertAlmostEqual(actual, expected)
        for actual, expected in zip(
            [sum(row[column] for row in matrix) for column in range(5)],
            ownership_margins,
        ):
            self.assertAlmostEqual(actual, expected, delta=expected * 2e-4)

    def test_furness_does_not_duplicate_population_across_ownership_classes(self) -> None:
        seed = [[1.0, 1.0, 1.0, 1.0, 0.0]]
        age_margins = [100.0]
        ownership_margins = [10.0, 20.0, 30.0, 40.0, 0.0]

        matrix = _furness_age_ownership(seed, age_margins, ownership_margins)

        self.assertAlmostEqual(sum(matrix[0]), 100.0)
        for actual, expected in zip(matrix[0], ownership_margins):
            self.assertAlmostEqual(actual, expected)


class PublicAPIValidationTests(unittest.TestCase):
    def test_missing_required_inputs_are_rejected(self) -> None:
        with self.assertRaises(GenerationInputError):
            run({}, year=2032)

    def test_year_must_be_a_positive_integer_not_boolean(self) -> None:
        for year in (None, True, False, 0, -1, 2032.5, "2032"):
            with self.subTest(year=year), self.assertRaisesRegex(GenerationInputError, "year"):
                run(fixture_inputs(), year=year)


@unittest.skipUnless(HAS_LOCAL_INPUTS and HAS_LOCAL_GOLDENS, LOCAL_FIXTURE_REASON)
class Generation2032RegressionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.before = fixture_snapshot()
        cls.result = run(fixture_inputs(), year=2032)

    def test_all_five_csv_tables_match_every_golden_cell_and_column_order(self) -> None:
        for name, (attribute, expected_count, expected_columns) in GOLDEN_TABLES.items():
            with self.subTest(table=name):
                actual_rows = getattr(self.result.artifacts, attribute)
                self.assertEqual(len(actual_rows), expected_count)
                with (FIXTURE / "expected" / name).open(encoding="utf-8-sig", newline="") as handle:
                    reader = csv.reader(handle)
                    header = next(reader)
                    self.assertEqual(len(header), expected_columns)
                    self.assertEqual(list(actual_rows[0]), header)
                    for row_number, (actual, expected) in enumerate(zip_longest(actual_rows, reader), 2):
                        self.assertIsNotNone(actual, f"{name}: extra golden row {row_number}")
                        self.assertIsNotNone(expected, f"{name}: missing golden row {row_number}")
                        self.assertEqual(
                            [str(actual[key]) if actual[key] is not None else "" for key in header],
                            expected,
                            f"{name}: row {row_number} differs",
                        )

    def test_totals_and_furness_residual_match_golden_json(self) -> None:
        expected = json.loads((FIXTURE / "expected" / "trip_generation_totals.json").read_text(encoding="utf-8"))
        self.assertEqual(self.result.artifacts.summary, expected)
        cross_classification = self.result.artifacts.summary["cross_classification"]
        self.assertEqual(cross_classification["iterations"], 5)
        self.assertEqual(cross_classification["max_row_residual"], 0.0)
        self.assertEqual(cross_classification["max_column_residual"], 1.360739)

    def test_legacy_qa_semantics_and_input_counts_are_preserved(self) -> None:
        expected = json.loads((FIXTURE / "expected" / "trip_generation_qa.json").read_text(encoding="utf-8"))
        self.assertEqual(self.result.qa, expected)
        self.assertEqual(self.result.qa["age_total_mismatch_count_over_5pct"], 1)
        self.assertEqual(self.result.qa["ownership_total_mismatch_count_over_5pct"], 0)
        self.assertEqual(
            self.result.counts,
            {
                "demographic_rows": 1778,
                "attraction_rows": 1805,
                "survey_trip_rate_rows": 72,
                "tour_trip_rate_rows": 72,
                "seed_rows": 144,
                "density_adjustment_rows": 4,
                "year_adjustment_rows": 8,
            },
        )

    def test_known_data_quality_issues_are_reported_not_presented_as_clean(self) -> None:
        self.assertTrue(self.result.warnings)
        warning_text = " ".join(self.result.warnings).lower()
        self.assertIn("blank", warning_text)
        self.assertIn("age", warning_text)
        self.assertIn("furness", warning_text)
        self.assertIn("1.360739", warning_text)

    def test_tour_rates_are_optional_and_do_not_change_calculation(self) -> None:
        inputs = fixture_inputs()
        del inputs["tour_trip_rate_csv"]
        without_tour = run(inputs, year=2032)
        self.assertEqual(without_tour.artifacts, self.result.artifacts)
        self.assertEqual(without_tour.counts["tour_trip_rate_rows"], 0)

    @classmethod
    def tearDownClass(cls) -> None:
        if fixture_snapshot() != cls.before:
            raise AssertionError("Trip Generation changed the copied input/golden fixture")


@unittest.skipUnless(HAS_LOCAL_INPUTS, LOCAL_FIXTURE_REASON)
class GenerationInputValidationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.inputs = fixture_inputs()
        self.temporary_directory = tempfile.TemporaryDirectory(prefix="thclaws-generation-test-")
        self.addCleanup(self.temporary_directory.cleanup)
        self.temp_root = Path(self.temporary_directory.name)

    def modified_csv(self, key: str, transform) -> dict[str, Path]:
        source = self.inputs[key]
        with source.open(encoding="utf-8-sig", newline="") as handle:
            rows = list(csv.reader(handle))
        transform(rows)
        target = self.temp_root / source.name
        with target.open("w", encoding="utf-8", newline="") as handle:
            csv.writer(handle).writerows(rows)
        return {**self.inputs, key: target}

    @staticmethod
    def data_row_indexes(rows: list[list[str]]) -> list[int]:
        return [
            index for index, row in enumerate(rows)
            if row and row[0].strip() and not row[0].strip().startswith(";")
        ]

    def test_each_required_input_key_is_required(self) -> None:
        for key in self.inputs:
            if key == "tour_trip_rate_csv":
                continue
            inputs = {name: path for name, path in self.inputs.items() if name != key}
            with self.subTest(key=key), self.assertRaises(GenerationInputError):
                run(inputs, year=2032)

    def test_unknown_year_does_not_silently_use_unit_factors(self) -> None:
        with self.assertRaises(GenerationInputError):
            run(self.inputs, year=2033)

    def test_missing_input_file_is_rejected(self) -> None:
        with self.assertRaises(GenerationInputError):
            run({**self.inputs, "survey_trip_rate_csv": self.temp_root / "missing.csv"}, year=2032)

    def test_directory_cannot_be_used_as_an_input_file(self) -> None:
        with self.assertRaises(GenerationInputError):
            run({**self.inputs, "survey_trip_rate_csv": self.temp_root}, year=2032)

    def test_nonfinite_survey_rates_are_rejected(self) -> None:
        for invalid in ("NaN", "Infinity", "-Infinity"):
            def change(rows, value=invalid):
                rows[self.data_row_indexes(rows)[0]][2] = value
            inputs = self.modified_csv("survey_trip_rate_csv", change)
            with self.subTest(value=invalid), self.assertRaises(GenerationInputError):
                run(inputs, year=2032)

    def test_duplicate_lookup_keys_are_rejected(self) -> None:
        for key in ("survey_trip_rate_csv", "seed_csv", "year_adjustment_csv"):
            def change(rows):
                rows.append(list(rows[self.data_row_indexes(rows)[0]]))
            inputs = self.modified_csv(key, change)
            with self.subTest(key=key), self.assertRaises(GenerationInputError):
                run(inputs, year=2032)

    def test_missing_required_lookup_rows_are_rejected_not_zero_filled(self) -> None:
        for key in ("survey_trip_rate_csv", "seed_csv"):
            def change(rows):
                del rows[self.data_row_indexes(rows)[0]]
            inputs = self.modified_csv(key, change)
            with self.subTest(key=key), self.assertRaises(GenerationInputError):
                run(inputs, year=2032)

    def test_truncated_csv_rows_are_rejected_not_skipped(self) -> None:
        for key in ("survey_trip_rate_csv", "seed_csv", "density_adjustment_csv", "year_adjustment_csv"):
            def change(rows):
                rows[self.data_row_indexes(rows)[0]] = ["111"]
            inputs = self.modified_csv(key, change)
            with self.subTest(key=key), self.assertRaises(GenerationInputError):
                run(inputs, year=2032)

    def test_empty_year_factor_is_rejected_not_replaced_with_one(self) -> None:
        def change(rows):
            next(row for row in rows if row and row[0].strip() == "2032")[1] = ""
        inputs = self.modified_csv("year_adjustment_csv", change)
        with self.assertRaises(GenerationInputError):
            run(inputs, year=2032)

    def test_empty_density_factor_is_rejected_not_replaced_with_one(self) -> None:
        def change(rows):
            rows[self.data_row_indexes(rows)[0]][2] = ""
        inputs = self.modified_csv("density_adjustment_csv", change)
        with self.assertRaises(GenerationInputError):
            run(inputs, year=2032)

    def test_truncated_dbf_is_rejected_not_partially_loaded(self) -> None:
        for key in ("demographic_dbf", "attraction_dbf"):
            target = self.temp_root / self.inputs[key].name
            target.write_bytes(self.inputs[key].read_bytes()[:-50])
            with self.subTest(key=key), self.assertRaises(GenerationInputError):
                run({**self.inputs, key: target}, year=2032)

    def test_missing_required_dbf_field_is_rejected_not_zero_filled(self) -> None:
        for key, field_name in (("demographic_dbf", "POP"), ("attraction_dbf", "PRIMARY")):
            contents = bytearray(self.inputs[key].read_bytes())
            header_length = struct.unpack_from("<H", contents, 8)[0]
            for offset in range(32, header_length - 1, 32):
                name = contents[offset:offset + 11].split(b"\0", 1)[0].decode("ascii").strip()
                if name == field_name:
                    contents[offset:offset + 11] = b"UNUSED".ljust(11, b"\0")
                    break
            else:
                self.fail(f"Fixture DBF does not contain {field_name}")
            target = self.temp_root / self.inputs[key].name
            target.write_bytes(contents)
            with self.subTest(key=key), self.assertRaises(GenerationInputError):
                run({**self.inputs, key: target}, year=2032)

    def test_duplicate_dbf_zones_are_rejected_not_overwritten(self) -> None:
        for key in ("demographic_dbf", "attraction_dbf"):
            contents = bytearray(self.inputs[key].read_bytes())
            header_length = struct.unpack_from("<H", contents, 8)[0]
            record_length = struct.unpack_from("<H", contents, 10)[0]
            zone_offset = 1
            for offset in range(32, header_length - 1, 32):
                name = contents[offset:offset + 11].split(b"\0", 1)[0].decode("ascii").strip()
                field_width = contents[offset + 16]
                if name == "ZONE":
                    break
                zone_offset += field_width
            else:
                self.fail("Fixture DBF does not contain ZONE")
            first = header_length + zone_offset
            second = first + record_length
            contents[second:second + field_width] = contents[first:first + field_width]
            target = self.temp_root / self.inputs[key].name
            target.write_bytes(contents)
            with self.subTest(key=key), self.assertRaises(GenerationInputError):
                run({**self.inputs, key: target}, year=2032)


if __name__ == "__main__":
    unittest.main()
