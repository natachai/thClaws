from __future__ import annotations

import struct
from pathlib import Path


def _parse_numeric(text: str) -> int | float | None:
    value = text.strip()
    if not value:
        return None
    if "." in value:
        return float(value)
    return int(value)


def read_dbf(path: Path) -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    with path.open("rb") as handle:
        header = handle.read(32)
        header_len = struct.unpack("<H", header[8:10])[0]
        record_len = struct.unpack("<H", header[10:12])[0]

        fields: list[tuple[str, str, int]] = []
        while True:
            descriptor = handle.read(32)
            if not descriptor or descriptor[0] == 0x0D:
                break
            name = descriptor[0:11].split(b"\x00", 1)[0].decode("ascii", errors="ignore").strip()
            field_type = chr(descriptor[11])
            length = descriptor[16]
            fields.append((name, field_type, length))

        handle.seek(header_len)
        while True:
            record = handle.read(record_len)
            if not record or len(record) < record_len:
                break
            if record[0] == 0x2A:
                continue

            row: dict[str, object] = {}
            offset = 1
            for name, field_type, length in fields:
                raw = record[offset : offset + length]
                offset += length
                text = raw.decode("latin-1", errors="ignore").strip()
                if field_type == "N":
                    row[name] = _parse_numeric(text)
                else:
                    row[name] = text
            rows.append(row)
    return rows
