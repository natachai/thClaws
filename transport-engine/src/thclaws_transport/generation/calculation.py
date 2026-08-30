from __future__ import annotations

from dataclasses import dataclass


PURPOSES = ["HBW", "HBE", "HBO", "NHB"]
VEHICLE_CLASSES = ["VEH0", "MC", "CAR", "MULTI"]
FURNESS_VEHICLE_CLASSES = ["VEH0", "MC", "CAR", "VEH2", "VEH3"]
FURNESS_RATE_KEYS = ["veh0", "mc", "car", "multi", "multi_plus"]
FURNESS_OWNERSHIP_FIELDS = ["VEH0", "MC", "CAR", "VEH2", "VEH3"]
FURNESS_ITERATIONS = 5
PURPOSE_CODE = {"HBW": 1, "HBE": 2, "HBO": 3, "NHB": 4}
OWNERSHIP_EXPORT = {"VEH0": "OVEH", "MC": "MC", "CAR": "PC", "MULTI": "MULTI"}

MRT_FACTORS = {
    "INSIDE": {"HBW": 1.04, "HBE": 1.04, "HBO": 1.06, "NHB": 1.05},
    "OUTSIDE": {"HBW": 1.00, "HBE": 1.00, "HBO": 1.00, "NHB": 1.00},
}

ATTRACTION_COEFFICIENTS = {
    1: {
        "HBW": {
            "VEH0": (0.002, 0.003, 0.004), "MC": (0.002, 0.003, 0.004),
            "CAR": (0.004, 0.005, 0.007), "MULTI": (0.002, 0.004, 0.005),
        },
        "HBE": {"VEH0": 0.248, "MC": 0.282, "CAR": 0.512, "MULTI": 0.331},
        "HBO": {"VEH0": (0.002, 0.001), "MC": (0.003, 0.001), "CAR": (0.006, 0.002), "MULTI": (0.004, 0.001)},
        "NHB": {"VEH0": (0.001, 0.001), "MC": (0.002, 0.001), "CAR": (0.003, 0.001), "MULTI": (0.002, 0.001)},
    },
    2: {
        "HBW": {
            "VEH0": (0.167, 0.239, 0.310), "MC": (0.188, 0.268, 0.349),
            "CAR": (0.337, 0.481, 0.626), "MULTI": (0.221, 0.315, 0.410),
        },
        "HBE": {"VEH0": 0.089, "MC": 0.101, "CAR": 0.183, "MULTI": 0.118},
        "HBO": {"VEH0": (0.040, 0.014), "MC": (0.044, 0.014), "CAR": (0.098, 0.026), "MULTI": (0.063, 0.023)},
        "NHB": {"VEH0": (0.024, 0.013), "MC": (0.050, 0.013), "CAR": (0.067, 0.025), "MULTI": (0.046, 0.022)},
    },
    3: {
        "HBW": {
            "VEH0": (0.003, 0.004, 0.005), "MC": (0.003, 0.005, 0.006),
            "CAR": (0.006, 0.008, 0.011), "MULTI": (0.004, 0.006, 0.007),
        },
        "HBE": {"VEH0": 0.004, "MC": 0.005, "CAR": 0.008, "MULTI": 0.005},
        "HBO": {"VEH0": (0.010, 0.003), "MC": (0.011, 0.003), "CAR": (0.024, 0.006), "MULTI": (0.016, 0.006)},
        "NHB": {"VEH0": (0.001, 0.001), "MC": (0.002, 0.001), "CAR": (0.002, 0.001), "MULTI": (0.002, 0.001)},
    },
}


@dataclass(slots=True)
class CalculationArtifacts:
    zone_rows: list[dict[str, object]]
    long_rows: list[dict[str, object]]
    age_long_rows: list[dict[str, object]]
    production_wide_rows: list[dict[str, object]]
    attraction_wide_rows: list[dict[str, object]]
    summary: dict[str, object]
    qa_log: list[str]


def _num(value: object) -> float:
    if value is None or value == "":
        return 0.0
    return float(value)


def _trip_rate_lookup(rows: list[dict[str, object]]) -> dict[int, dict[str, float]]:
    lookup: dict[int, dict[str, float]] = {}
    for row in rows:
        lookup[int(row["index"])] = {
            "veh0": float(row["veh0"] or 0.0),
            "mc": float(row["mc"] or 0.0),
            "car": float(row["car"] or 0.0),
            "multi": float(row["multi"] or 0.0),
            "multi_plus": float(row["multi_plus"] or 0.0),
        }
    return lookup


def _seed_lookup(rows: list[dict[str, object]]) -> dict[int, list[float]]:
    return {
        int(row["index"]): [float(row.get(key) or 0.0) for key in FURNESS_RATE_KEYS]
        for row in rows
    }


def _furness_age_ownership(
    seed_matrix: list[list[float]],
    age_margins: list[float],
    ownership_margins: list[float],
    iterations: int = FURNESS_ITERATIONS,
) -> list[list[float]]:
    """Apply the five Cube column/row Furness corrections in source order."""
    matrix = [[float(value) for value in row] for row in seed_matrix]
    for _ in range(iterations):
        for column, target in enumerate(ownership_margins):
            current = sum(row[column] for row in matrix)
            factor = target / current if current > 0.0 else 0.0
            for row in matrix:
                row[column] *= factor

        for row_index, target in enumerate(age_margins):
            current = sum(matrix[row_index])
            factor = target / current if current > 0.0 else 0.0
            matrix[row_index] = [value * factor for value in matrix[row_index]]
    return matrix


def _zone_age_ownership_matrix(
    zone: dict[str, object],
    seed_rows: dict[int, list[float]],
) -> tuple[list[list[float]], float, float]:
    province = int(_num(zone.get("PROVINCE")))
    region = int(_num(zone.get("TG_REGION")) or 1)
    seed_base = province * 100 + region * 10
    seed_matrix = [seed_rows.get(seed_base + age, [0.0] * 5) for age in range(1, 7)]
    age_margins = [
        _num(zone.get("AGE1")),
        _num(zone.get("AGE2")),
        _num(zone.get("AGE3")),
        _num(zone.get("AGE4")) + _num(zone.get("AGE5")) + _num(zone.get("AGE6")),
        0.0,
        0.0,
    ]
    ownership_margins = [_num(zone.get(field)) for field in FURNESS_OWNERSHIP_FIELDS]
    matrix = _furness_age_ownership(seed_matrix, age_margins, ownership_margins)
    row_residual = max(
        (abs(sum(row) - target) for row, target in zip(matrix, age_margins)),
        default=0.0,
    )
    column_residual = max(
        (
            abs(sum(row[column] for row in matrix) - ownership_margins[column])
            for column in range(5)
        ),
        default=0.0,
    )
    return matrix, row_residual, column_residual


def _year_factor_lookup(row: dict[str, object] | None) -> dict[tuple[str, str], float]:
    if row is None:
        return {(p, v): 1.0 for p in PURPOSES for v in VEHICLE_CLASSES}
    return {
        ("HBW", "VEH0"): float(row["hbw_veh0"] or 1.0),
        ("HBW", "MC"): float(row["hbw_mc"] or 1.0),
        ("HBW", "CAR"): float(row["hbw_car"] or 1.0),
        ("HBW", "MULTI"): float(row["hbw_multi"] or 1.0),
        ("HBE", "VEH0"): float(row["hbe_veh0"] or 1.0),
        ("HBE", "MC"): float(row["hbe_mc"] or 1.0),
        ("HBE", "CAR"): float(row["hbe_car"] or 1.0),
        ("HBE", "MULTI"): float(row["hbe_multi"] or 1.0),
        ("HBO", "VEH0"): float(row["hbo_veh0"] or 1.0),
        ("HBO", "MC"): float(row["hbo_mc"] or 1.0),
        ("HBO", "CAR"): float(row["hbo_car"] or 1.0),
        ("HBO", "MULTI"): float(row["hbo_multi"] or 1.0),
        ("NHB", "VEH0"): float(row["nhb_veh0"] or 1.0),
        ("NHB", "MC"): float(row["nhb_mc"] or 1.0),
        ("NHB", "CAR"): float(row["nhb_car"] or 1.0),
        ("NHB", "MULTI"): float(row["nhb_multi"] or 1.0),
    }


def _density_factor_lookup(rows: list[dict[str, object]]) -> list[dict[str, object]]:
    return sorted(rows, key=lambda row: float(row["lower_density_bound"] or 0.0))


def _age_attraction(
    zone: dict[str, object], age_group: int, purpose: str, vehicle_class: str
) -> float:
    coefficients = ATTRACTION_COEFFICIENTS[age_group][purpose][vehicle_class]
    if purpose == "HBW":
        primary, secondary, tertiary = coefficients
        return (
            primary * _num(zone.get("PRIMARY")) * _num(zone.get("ATT_FAC"))
            + secondary * _num(zone.get("SECNDR"))
            + tertiary * _num(zone.get("TERTIARY"))
        )
    if purpose == "HBE":
        ram_factor = 0.25 if int(_num(zone.get("ZONE"))) == 498 else 1.0
        return _num(zone.get("STUDYPLACE")) * float(coefficients) * ram_factor
    tertiary, commercial = coefficients
    commercial_area = _num(zone.get("COM_AREA1")) + _num(zone.get("COM_AREA2"))
    return (
        tertiary * _num(zone.get("TERTIARY"))
        + commercial * commercial_area * _num(zone.get("COM_FACTOR"))
    )


def _area_type(zone: dict[str, object]) -> str:
    region = int(_num(zone.get("TG_REGION")) or 2)
    if region == 1:
        return "CBD"
    if region == 2:
        return "URBAN"
    return "SUBURBAN"


def _mrt_class(zone: dict[str, object]) -> str:
    return "INSIDE" if _num(zone.get("MRT_ZONE")) > 0 else "OUTSIDE"


def _density_factor(density_rows: list[dict[str, object]], purpose: str, zone: dict[str, object]) -> float:
    area = _num(zone.get("AREA"))
    pop = _num(zone.get("POP"))
    if area <= 0:
        return 1.0
    density = pop / area
    chosen = density_rows[0] if density_rows else None
    for row in density_rows:
        if density >= float(row["lower_density_bound"] or 0.0):
            chosen = row
    if chosen is None:
        return 1.0
    key = purpose.lower()
    return float(chosen[key] or 1.0)


def _safe_balance_factor(total_prod: float, total_attr: float) -> float:
    if total_attr > 0:
        return total_prod / total_attr
    if total_prod == 0:
        return 1.0
    return 0.0


def _build_wide_rows(zone_rows: list[dict[str, object]], field_prefix: str) -> list[dict[str, object]]:
    wide_rows: list[dict[str, object]] = []
    for row in zone_rows:
        out: dict[str, object] = {"ZONE": row["ZONE"]}
        for purpose in PURPOSES:
            for vehicle_class in VEHICLE_CLASSES:
                export_ownership = OWNERSHIP_EXPORT[vehicle_class]
                src_key = f"{field_prefix}_{purpose}_{vehicle_class}"
                dst_key = f"{field_prefix}_{purpose}_{export_ownership}"
                out[dst_key] = row[src_key]
        wide_rows.append(out)
    return wide_rows


def calculate_trip_generation(
    demographic_rows: list[dict[str, object]],
    attraction_rows: list[dict[str, object]],
    survey_trip_rates: list[dict[str, object]],
    seed_rows: list[dict[str, object]],
    selected_year_adjustment: dict[str, object] | None,
    density_adjustment_rows: list[dict[str, object]],
) -> CalculationArtifacts:
    rate_lookup = _trip_rate_lookup(survey_trip_rates)
    seeds = _seed_lookup(seed_rows)
    year_factors = _year_factor_lookup(selected_year_adjustment)
    density_lookup = _density_factor_lookup(density_adjustment_rows)
    attraction_by_zone = {int(_num(row.get("ZONE"))): row for row in attraction_rows}

    zone_rows: list[dict[str, object]] = []
    long_rows: list[dict[str, object]] = []
    age_long_rows: list[dict[str, object]] = []
    total_production = {(p, v): 0.0 for p in PURPOSES for v in VEHICLE_CLASSES}
    total_attraction = {(p, v): 0.0 for p in PURPOSES for v in VEHICLE_CLASSES}
    age_total_production = {(a, p, v): 0.0 for a in range(1, 4) for p in PURPOSES for v in VEHICLE_CLASSES}
    age_total_attraction = {(a, p, v): 0.0 for a in range(1, 4) for p in PURPOSES for v in VEHICLE_CLASSES}
    age_production_rows: list[dict[tuple[int, str, str], float]] = []
    age_attraction_rows: list[dict[tuple[int, str, str], float]] = []
    qa_log: list[str] = []
    max_furness_row_residual = 0.0
    max_furness_column_residual = 0.0

    for zone in demographic_rows:
        region = int(_num(zone.get("TG_REGION")) or 1)
        zone_id = int(_num(zone.get("ZONE")) or 0)
        area_type = _area_type(zone)
        mrt_class = _mrt_class(zone)
        age_ownership, row_residual, column_residual = _zone_age_ownership_matrix(zone, seeds)
        max_furness_row_residual = max(max_furness_row_residual, row_residual)
        max_furness_column_residual = max(max_furness_column_residual, column_residual)
        out: dict[str, object] = {
            "ZONE": zone_id,
            "TG_REGION": region,
            "AREA_TYPE": area_type,
            "MRT_CLASS": mrt_class,
            "FURNESS_MAX_ROW_RESIDUAL": round(row_residual, 6),
            "FURNESS_MAX_COLUMN_RESIDUAL": round(column_residual, 6),
        }
        attraction_zone = attraction_by_zone.get(zone_id, {})
        zone_age_production: dict[tuple[int, str, str], float] = {}
        zone_age_attraction: dict[tuple[int, str, str], float] = {}
        for purpose in PURPOSES:
            mrt_factor = MRT_FACTORS[mrt_class][purpose]
            density_factor = _density_factor(density_lookup, purpose, zone)
            five_class_productions: dict[str, float] = {}
            five_class_age_productions: dict[str, list[float]] = {}
            for ownership_index, vehicle_class in enumerate(FURNESS_VEHICLE_CLASSES):
                age_productions: list[float] = []
                for age_group in range(1, 7):
                    index = region * 100 + PURPOSE_CODE[purpose] * 10 + age_group
                    rate_row = rate_lookup.get(index, {})
                    rate = float(rate_row.get(FURNESS_RATE_KEYS[ownership_index], 0.0))
                    age_productions.append(age_ownership[age_group - 1][ownership_index] * rate)
                output_class = vehicle_class if vehicle_class in VEHICLE_CLASSES else "MULTI"
                factor = year_factors[(purpose, output_class)] * mrt_factor * density_factor
                age_productions = [value * factor for value in age_productions]
                five_class_age_productions[vehicle_class] = age_productions
                five_class_productions[vehicle_class] = sum(age_productions)

            productions = {
                "VEH0": five_class_productions["VEH0"],
                "MC": five_class_productions["MC"],
                "CAR": five_class_productions["CAR"],
                "MULTI": five_class_productions["VEH2"] + five_class_productions["VEH3"],
            }
            for vehicle_class, production in productions.items():
                for age_group in range(1, 4):
                    if vehicle_class == "MULTI":
                        age_production = (
                            five_class_age_productions["VEH2"][age_group - 1]
                            + five_class_age_productions["VEH3"][age_group - 1]
                        )
                    else:
                        age_production = five_class_age_productions[vehicle_class][age_group - 1]
                    key = (age_group, purpose, vehicle_class)
                    age_attraction = _age_attraction(attraction_zone, *key)
                    zone_age_production[key] = age_production
                    zone_age_attraction[key] = age_attraction
                    age_total_production[key] += age_production
                    age_total_attraction[key] += age_attraction
                attraction_raw = sum(
                    zone_age_attraction[(age, purpose, vehicle_class)] for age in range(1, 4)
                )

                out[f"P_{purpose}_{vehicle_class}"] = round(production, 6)
                out[f"A_RAW_{purpose}_{vehicle_class}"] = round(attraction_raw, 6)

                total_production[(purpose, vehicle_class)] += production
                total_attraction[(purpose, vehicle_class)] += attraction_raw

        zone_rows.append(out)
        age_production_rows.append(zone_age_production)
        age_attraction_rows.append(zone_age_attraction)

    age_balance_factors = {
        (age, purpose, vehicle_class): _safe_balance_factor(
            age_total_production[(age, purpose, vehicle_class)],
            age_total_attraction[(age, purpose, vehicle_class)],
        )
        for age in range(1, 4)
        for purpose in PURPOSES
        for vehicle_class in VEHICLE_CLASSES
    }
    balance_factors = {
        (purpose, vehicle_class): _safe_balance_factor(
            total_production[(purpose, vehicle_class)], total_attraction[(purpose, vehicle_class)]
        )
        for purpose in PURPOSES for vehicle_class in VEHICLE_CLASSES
    }

    balanced_totals = {(p, v): 0.0 for p in PURPOSES for v in VEHICLE_CLASSES}
    for row_index, row in enumerate(zone_rows):
        for purpose in PURPOSES:
            for vehicle_class in VEHICLE_CLASSES:
                raw_key = f"A_RAW_{purpose}_{vehicle_class}"
                bal_key = f"A_BAL_{purpose}_{vehicle_class}"
                raw = float(row[raw_key])
                balanced = sum(
                    age_attraction_rows[row_index][(age, purpose, vehicle_class)]
                    * age_balance_factors[(age, purpose, vehicle_class)]
                    for age in range(1, 4)
                )
                row[bal_key] = round(balanced, 6)
                balanced_totals[(purpose, vehicle_class)] += balanced

                long_rows.append(
                    {
                        "ZONE": row["ZONE"],
                        "purpose": purpose,
                        "ownership": OWNERSHIP_EXPORT[vehicle_class],
                        "production": round(float(row[f"P_{purpose}_{vehicle_class}"]), 6),
                        "attraction_raw": round(raw, 6),
                        "attraction_balanced": round(balanced, 6),
                    }
                )
                for age in range(1, 4):
                    age_raw = age_attraction_rows[row_index][(age, purpose, vehicle_class)]
                    age_balanced = age_raw * age_balance_factors[(age, purpose, vehicle_class)]
                    age_long_rows.append(
                        {
                            "ZONE": row["ZONE"],
                            "age_group": age,
                            "purpose": purpose,
                            "ownership": OWNERSHIP_EXPORT[vehicle_class],
                            "production": round(
                                age_production_rows[row_index][(age, purpose, vehicle_class)], 6
                            ),
                            "attraction_raw": round(age_raw, 6),
                            "attraction_balanced": round(age_balanced, 6),
                        }
                    )

    production_wide_rows = _build_wide_rows(zone_rows, "P")
    attraction_wide_rows = []
    for row in zone_rows:
        out: dict[str, object] = {"ZONE": row["ZONE"]}
        for purpose in PURPOSES:
            for vehicle_class in VEHICLE_CLASSES:
                export_ownership = OWNERSHIP_EXPORT[vehicle_class]
                out[f"A_{purpose}_{export_ownership}"] = row[f"A_BAL_{purpose}_{vehicle_class}"]
        attraction_wide_rows.append(out)

    summary = {
        "zone_count": len(zone_rows),
        "cross_classification": {
            "method": "cube_age_vehicle_furness",
            "iterations": FURNESS_ITERATIONS,
            "max_row_residual": round(max_furness_row_residual, 6),
            "max_column_residual": round(max_furness_column_residual, 6),
        },
        "production_totals": {
            f"{purpose}_{vehicle_class}": round(total_production[(purpose, vehicle_class)], 6)
            for purpose in PURPOSES
            for vehicle_class in VEHICLE_CLASSES
        },
        "attraction_raw_totals": {
            f"{purpose}_{vehicle_class}": round(total_attraction[(purpose, vehicle_class)], 6)
            for purpose in PURPOSES
            for vehicle_class in VEHICLE_CLASSES
        },
        "attraction_balanced_totals": {
            f"{purpose}_{vehicle_class}": round(balanced_totals[(purpose, vehicle_class)], 6)
            for purpose in PURPOSES
            for vehicle_class in VEHICLE_CLASSES
        },
        "balance_factors": {
            f"{purpose}_{vehicle_class}": round(balance_factors[(purpose, vehicle_class)], 10)
            for purpose in PURPOSES
            for vehicle_class in VEHICLE_CLASSES
        },
        "age_balance_factors": {
            f"AGE{age}_{purpose}_{vehicle_class}": round(
                age_balance_factors[(age, purpose, vehicle_class)], 10
            )
            for age in range(1, 4)
            for purpose in PURPOSES
            for vehicle_class in VEHICLE_CLASSES
        },
    }
    return CalculationArtifacts(
        zone_rows=zone_rows,
        long_rows=long_rows,
        age_long_rows=age_long_rows,
        production_wide_rows=production_wide_rows,
        attraction_wide_rows=attraction_wide_rows,
        summary=summary,
        qa_log=sorted(set(qa_log)),
    )
