"""Strict explicit-file readers around the copied eBUMpy input conventions.

This module only reads inputs. It does not discover legacy workspaces or write
snapshots. Calculation formulas remain in the byte-identical calculation.py.
"""

from __future__ import annotations

import csv
import math
import struct
from pathlib import Path

from .dbf_reader import read_dbf


class GenerationInputError(ValueError):
    """A Trip Generation input is malformed, incomplete or ambiguous."""


RATE_KEYS = ("veh0", "mc", "car", "multi", "multi_plus")
DEMOGRAPHIC_FIELDS = (
    "ZONE", "PROVINCE", "TG_REGION", "AGE1", "AGE2", "AGE3", "AGE4", "AGE5", "AGE6",
    "VEH0", "MC", "CAR", "VEH2", "VEH3", "AREA", "POP", "MRT_ZONE",
)
ATTRACTION_FIELDS = (
    "ZONE", "PRIMARY", "ATT_FAC", "SECNDR", "TERTIARY", "STUDYPLACE",
    "COM_AREA1", "COM_AREA2", "COM_FACTOR",
)


def finite_number(value: object, label: str, *, nonnegative: bool = True) -> float:
    if value is None or isinstance(value, bool) or (isinstance(value, str) and not value.strip()):
        raise GenerationInputError(f"{label}: a numeric value is required; blank is not zero.")
    try:
        result = float(value)
    except (TypeError, ValueError, OverflowError) as exc:
        raise GenerationInputError(f"{label}: invalid numeric value {value!r}.") from exc
    if not math.isfinite(result):
        raise GenerationInputError(f"{label}: numeric value must be finite.")
    if nonnegative and result < 0:
        raise GenerationInputError(f"{label}: numeric value must be non-negative.")
    return result


def positive_integer(value: object, label: str) -> int:
    number = finite_number(value, label)
    if not number.is_integer() or number <= 0:
        raise GenerationInputError(f"{label}: a positive integer is required.")
    return int(number)


def _csv_rows(path: Path) -> list[tuple[int, list[str]]]:
    result: list[tuple[int, list[str]]] = []
    try:
        with path.open("r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.reader(handle, strict=True)
            for raw in reader:
                row = [cell.strip() for cell in raw]
                if not row or not any(row):
                    continue
                if row[0].startswith(";"):
                    continue
                if not row[0]:
                    raise GenerationInputError(f"{path.name}:{reader.line_num}: missing row identifier.")
                result.append((reader.line_num, row))
    except (csv.Error, UnicodeError) as exc:
        raise GenerationInputError(f"{path.name}: malformed CSV: {exc}.") from exc
    if not result:
        raise GenerationInputError(f"{path.name}: input table has no data rows.")
    return result


def _width(row: list[str], allowed: tuple[int, ...], label: str) -> None:
    if len(row) not in allowed:
        expected = " or ".join(str(value) for value in allowed)
        raise GenerationInputError(f"{label}: expected {expected} columns, got {len(row)}; row may be truncated.")


def _unique(value: int | float, seen: set[int | float], label: str) -> None:
    if value in seen:
        raise GenerationInputError(f"{label}: duplicate identifier {value}.")
    seen.add(value)


def _age_group(value: str, index: int, label: str) -> int:
    age = positive_integer(value, f"{label} age_group")
    if age not in range(1, 7) or index % 10 != age:
        raise GenerationInputError(f"{label}: age_group must be 1–6 and match the index's last digit.")
    return age


def load_trip_rate_table(path: Path, *, provenance_only: bool = False) -> list[dict[str, object]]:
    parsed: list[dict[str, object]] = []
    seen: set[int | float] = set()
    for line, row in _csv_rows(path):
        label = f"{path.name}:{line}"
        _width(row, (7, 8), label)
        index = positive_integer(row[0], f"{label} index")
        _unique(index, seen, label)
        age = _age_group(row[1], index, label)
        if index // 100 < 1 or (index % 100) // 10 not in range(1, 5):
            raise GenerationInputError(f"{label}: rate index must encode region, purpose 1–4 and age 1–6.")
        rates = row[2:7]
        blank_row = all(not value for value in rates)
        # The supplied survey has entirely blank age 4–6 rate rows. The tour
        # table additionally has blank age 1–3 rows but is provenance-only.
        allow_blank = blank_row and (age >= 4 or provenance_only)
        values = {key: None if allow_blank else finite_number(value, f"{label} {key}") for key, value in zip(RATE_KEYS, rates)}
        region = positive_integer(row[7], f"{label} region") if len(row) == 8 else None
        if region is not None and region != index // 100:
            raise GenerationInputError(f"{label}: region does not match the rate index.")
        parsed.append({"index": index, "age_group": age, **values, "region": region})
    return parsed


def load_seed_table(path: Path) -> list[dict[str, object]]:
    parsed: list[dict[str, object]] = []
    seen: set[int | float] = set()
    for line, row in _csv_rows(path):
        label = f"{path.name}:{line}"
        _width(row, (7,), label)
        index = positive_integer(row[0], f"{label} index")
        _unique(index, seen, label)
        age = _age_group(row[1], index, label)
        values: dict[str, object] = {}
        blank_row = all(not value for value in row[2:7])
        for key, value in zip(RATE_KEYS, row[2:7]):
            # These are the two blank patterns present in the copied seed:
            # whole empty rows (including unused province/region combinations),
            # and multi_plus in otherwise numeric rows.
            allow_blank = blank_row or (key == "multi_plus" and not value)
            values[key] = None if allow_blank else finite_number(value, f"{label} {key}")
        parsed.append({"index": index, "age_group": age, **values})
    return parsed


def load_density_adjustments(path: Path) -> list[dict[str, object]]:
    parsed: list[dict[str, object]] = []
    groups: set[int | float] = set()
    bounds: set[int | float] = set()
    for line, row in _csv_rows(path):
        label = f"{path.name}:{line}"
        _width(row, (6, 7), label)
        group = positive_integer(row[0], f"{label} density_group")
        bound = finite_number(row[1], f"{label} lower_density_bound")
        _unique(group, groups, label)
        _unique(bound, bounds, f"{label} density bound")
        values = {key: finite_number(value, f"{label} {key}") for key, value in zip(("hbw", "hbe", "hbo", "nhb"), row[2:6])}
        parsed.append({"density_group": group, "lower_density_bound": bound, **values, "note": row[6] if len(row) == 7 else None})
    return parsed


def load_year_adjustments(path: Path) -> list[dict[str, object]]:
    parsed: list[dict[str, object]] = []
    seen: set[int | float] = set()
    keys = tuple(f"{purpose}_{ownership}" for purpose in ("hbw", "hbe", "hbo", "nhb") for ownership in ("veh0", "mc", "car", "multi"))
    for line, row in _csv_rows(path):
        label = f"{path.name}:{line}"
        _width(row, (17,), label)
        year = positive_integer(row[0], f"{label} year")
        _unique(year, seen, label)
        parsed.append({"year": year, **{key: finite_number(value, f"{label} {key}") for key, value in zip(keys, row[1:])}})
    return parsed


def load_dbf_table(path: Path, required_fields: tuple[str, ...]) -> list[dict[str, object]]:
    """Check DBF framing before the unchanged legacy reader can ignore truncation."""
    with path.open("rb") as handle:
        header = handle.read(32)
        if len(header) != 32:
            raise GenerationInputError(f"{path.name}: truncated DBF header.")
        count = struct.unpack("<I", header[4:8])[0]
        header_length = struct.unpack("<H", header[8:10])[0]
        record_length = struct.unpack("<H", header[10:12])[0]
        if header_length < 33 or (header_length - 33) % 32 != 0 or record_length < 2 or count == 0:
            raise GenerationInputError(f"{path.name}: invalid or empty DBF structure.")
        descriptors = handle.read(header_length - 32)
        if len(descriptors) != header_length - 32 or descriptors[-1] != 0x0D:
            raise GenerationInputError(f"{path.name}: truncated DBF field descriptors.")
        fields: list[tuple[str, str, int]] = []
        for offset in range(0, len(descriptors) - 1, 32):
            descriptor = descriptors[offset:offset + 32]
            try:
                name = descriptor[:11].split(b"\x00", 1)[0].decode("ascii").strip()
            except UnicodeError as exc:
                raise GenerationInputError(f"{path.name}: invalid DBF field name.") from exc
            if not name or descriptor[16] == 0 or any(field[0] == name for field in fields):
                raise GenerationInputError(f"{path.name}: empty/duplicate DBF field or invalid width.")
            fields.append((name, chr(descriptor[11]), descriptor[16]))
        if 1 + sum(field[2] for field in fields) != record_length:
            raise GenerationInputError(f"{path.name}: DBF record length does not match field widths.")
        missing = set(required_fields) - {field[0] for field in fields}
        if missing:
            raise GenerationInputError(f"{path.name}: missing required fields: {', '.join(sorted(missing))}.")
        expected_bytes = header_length + count * record_length
        actual_bytes = path.stat().st_size
        if actual_bytes not in (expected_bytes, expected_bytes + 1):
            raise GenerationInputError(f"{path.name}: truncated or unexpected trailing DBF records.")
        for index in range(count):
            record = handle.read(record_length)
            if len(record) != record_length or record[0] not in (0x20, 0x2A):
                raise GenerationInputError(f"{path.name}: invalid DBF record {index + 1}.")
            if record[0] == 0x2A:
                continue
            offset = 1
            for name, field_type, width in fields:
                if field_type in ("N", "F"):
                    text = record[offset:offset + width].decode("ascii", errors="strict").strip()
                    finite_number(text, f"{path.name} row {index + 1} field {name}", nonnegative=name in required_fields)
                offset += width
        trailer = handle.read()
        if trailer not in (b"", b"\x1a"):
            raise GenerationInputError(f"{path.name}: invalid DBF end marker.")
    try:
        rows = read_dbf(path)
    except (ValueError, IndexError, struct.error) as exc:
        raise GenerationInputError(f"{path.name}: malformed DBF content: {exc}.") from exc
    if not rows:
        raise GenerationInputError(f"{path.name}: no active DBF records.")
    seen: set[int | float] = set()
    for index, row in enumerate(rows, start=1):
        for field in required_fields:
            finite_number(row[field], f"{path.name} row {index} field {field}")
        zone = positive_integer(row["ZONE"], f"{path.name} row {index} ZONE")
        _unique(zone, seen, f"{path.name} ZONE")
    return rows
