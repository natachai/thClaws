"""Explicit-input Trip Generation adapter; no discovery, output writes or UI code."""

from __future__ import annotations

import math
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path

from .calculation import CalculationArtifacts, calculate_trip_generation
from .loaders import (
    ATTRACTION_FIELDS,
    DEMOGRAPHIC_FIELDS,
    RATE_KEYS,
    GenerationInputError,
    load_dbf_table,
    load_density_adjustments,
    load_seed_table,
    load_trip_rate_table,
    load_year_adjustments,
    positive_integer,
)


REQUIRED_INPUTS = (
    "demographic_dbf", "attraction_dbf", "survey_trip_rate_csv", "seed_csv",
    "density_adjustment_csv", "year_adjustment_csv",
)
OPTIONAL_INPUTS = ("tour_trip_rate_csv",)


@dataclass(slots=True)
class GenerationResult:
    artifacts: CalculationArtifacts
    qa: dict[str, object]
    warnings: list[str]
    counts: dict[str, int]


def _check_coverage(
    demographics: list[dict[str, object]],
    attractions: list[dict[str, object]],
    seeds: list[dict[str, object]],
    rates: list[dict[str, object]],
) -> None:
    attraction_ids = {int(row["ZONE"]) for row in attractions}
    seed_ids = {int(row["index"]) for row in seeds}
    rate_ids = {int(row["index"]) for row in rates}
    for zone in demographics:
        zone_id = int(zone["ZONE"])
        province = positive_integer(zone["PROVINCE"], f"ZONE {zone_id} PROVINCE")
        region = positive_integer(zone["TG_REGION"], f"ZONE {zone_id} TG_REGION")
        if zone_id not in attraction_ids:
            raise GenerationInputError(f"ZONE {zone_id}: missing matching attraction row.")
        for age in range(1, 7):
            seed_index = province * 100 + region * 10 + age
            if seed_index not in seed_ids:
                raise GenerationInputError(f"ZONE {zone_id}: missing seed index {seed_index}.")
            for purpose in range(1, 5):
                rate_index = region * 100 + purpose * 10 + age
                if rate_index not in rate_ids:
                    raise GenerationInputError(f"ZONE {zone_id}: missing survey rate index {rate_index}.")


def _qa_summary(rows: list[dict[str, object]], validation: dict[str, bool], artifacts: CalculationArtifacts) -> dict[str, object]:
    age_mismatches = 0
    ownership_mismatches = 0
    for row in rows:
        population = float(row["POP"])
        age_total = sum(float(row[field]) for field in ("AGE1", "AGE2", "AGE3"))
        ownership_total = sum(float(row[field]) for field in ("VEH0", "MC", "CAR", "VEH2", "VEH3"))
        if population > 0 and abs(age_total - population) / population > 0.05:
            age_mismatches += 1
        if population > 0 and abs(ownership_total - population) / population > 0.05:
            ownership_mismatches += 1
    return {
        "input_row_count": len(rows),
        "number_of_zones": len(rows),
        "input_validation": validation,
        "age_total_mismatch_count_over_5pct": age_mismatches,
        "ownership_total_mismatch_count_over_5pct": ownership_mismatches,
        "total_productions_by_segment": artifacts.summary["production_totals"],
        "total_balanced_attractions_by_segment": artifacts.summary["attraction_balanced_totals"],
        "balance_factors_by_segment": artifacts.summary["balance_factors"],
        "warnings": list(artifacts.qa_log),
    }


def _check_finite_output(value: object, label: str = "calculation") -> None:
    if isinstance(value, float) and not math.isfinite(value):
        raise GenerationInputError(f"{label}: calculation produced a non-finite result; check input magnitudes.")
    if isinstance(value, dict):
        for key, item in value.items():
            _check_finite_output(item, f"{label}.{key}")
    elif isinstance(value, list):
        for item in value:
            _check_finite_output(item, label)


def run(inputs: Mapping[str, Path], *, year: int) -> GenerationResult:
    """Calculate from explicit local files; the caller owns output/run boundaries."""
    if not isinstance(year, int) or isinstance(year, bool) or year <= 0:
        raise GenerationInputError("year must be a positive integer.")
    missing = set(REQUIRED_INPUTS) - set(inputs)
    unknown = set(inputs) - set(REQUIRED_INPUTS + OPTIONAL_INPUTS)
    if missing:
        raise GenerationInputError(f"Missing required input(s): {', '.join(sorted(missing))}.")
    if unknown:
        raise GenerationInputError(f"Unknown input(s): {', '.join(sorted(unknown))}.")
    paths: dict[str, Path] = {}
    for key, value in inputs.items():
        try:
            path = Path(value)
        except TypeError as exc:
            raise GenerationInputError(f"{key}: an explicit file path is required.") from exc
        if not path.is_file():
            raise GenerationInputError(f"{key}: input file does not exist or is not a file: {path}.")
        paths[key] = path
    try:
        demographics = load_dbf_table(paths["demographic_dbf"], DEMOGRAPHIC_FIELDS)
        attractions = load_dbf_table(paths["attraction_dbf"], ATTRACTION_FIELDS)
        rates = load_trip_rate_table(paths["survey_trip_rate_csv"])
        seeds = load_seed_table(paths["seed_csv"])
        density = load_density_adjustments(paths["density_adjustment_csv"])
        years = load_year_adjustments(paths["year_adjustment_csv"])
        tours = load_trip_rate_table(paths["tour_trip_rate_csv"], provenance_only=True) if "tour_trip_rate_csv" in paths else []
    except (OSError, UnicodeError) as exc:
        raise GenerationInputError(f"Could not read Trip Generation inputs: {exc}.") from exc
    selected_year = next((row for row in years if row["year"] == year), None)
    if selected_year is None:
        raise GenerationInputError(f"No year adjustment exists for selected year {year}.")
    _check_coverage(demographics, attractions, seeds, rates)
    artifacts = calculate_trip_generation(demographics, attractions, rates, seeds, selected_year, density)
    for name in ("zone_rows", "long_rows", "age_long_rows", "production_wide_rows", "attraction_wide_rows", "summary"):
        _check_finite_output(getattr(artifacts, name), name)
    qa = _qa_summary(demographics, {key: True for key in paths}, artifacts)
    warnings = list(artifacts.qa_log)
    for name, rows in (("survey trip-rate", rates), ("seed", seeds)):
        blank_cells = sum(row[key] is None for row in rows for key in RATE_KEYS)
        if blank_cells:
            warnings.append(f"{name}: {blank_cells} documented legacy blank numeric cells were retained as zero by the unchanged calculation.")
    if tours:
        warnings.append("Tour trip-rate data is provenance-only; the copied Trip Generation algorithm does not use it.")
    for key, label in (("age_total_mismatch_count_over_5pct", "age"), ("ownership_total_mismatch_count_over_5pct", "ownership")):
        if qa[key]:
            warnings.append(f"{qa[key]} zone(s) have {label} totals differing from population by more than 5%; existing model semantics were preserved.")
    cross = artifacts.summary["cross_classification"]
    if float(cross["max_column_residual"]) > 0:
        warnings.append(f"Fixed {cross['iterations']}-iteration Furness maximum column residual: {cross['max_column_residual']}; this is not an exact-convergence claim.")
    counts = {
        "demographic_rows": len(demographics),
        "attraction_rows": len(attractions),
        "survey_trip_rate_rows": len(rates),
        "tour_trip_rate_rows": len(tours),
        "seed_rows": len(seeds),
        "density_adjustment_rows": len(density),
        "year_adjustment_rows": len(years),
    }
    return GenerationResult(artifacts=artifacts, qa=qa, warnings=warnings, counts=counts)
