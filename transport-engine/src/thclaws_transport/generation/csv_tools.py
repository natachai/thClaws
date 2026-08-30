from __future__ import annotations

import csv
from pathlib import Path


def read_comment_csv(path: Path) -> list[list[str]]:
    rows: list[list[str]] = []
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.reader(handle)
        for raw_row in reader:
            if not raw_row:
                continue
            first = (raw_row[0] or "").strip()
            if not first or first.startswith(";"):
                continue
            rows.append([cell.strip() for cell in raw_row])
    return rows


def safe_float(value: str) -> float | None:
    text = value.strip()
    if text == "":
        return None
    return float(text)

