"""
ComplianceEngine
================
The single source of truth for PASS/FAIL determination.

Rules:
- The frontend NEVER decides compliance — it only displays what this engine returns.
- Every result is traceable to a specific Rule (rule_id + rule_code + version).
- Calculation logic per test type lives here as small, pure functions so it's
  easy to audit and to add new OIML test modules later.
"""
from dataclasses import dataclass
from typing import Any, Optional

from sqlalchemy.orm import Session

from app.models.rules import Rule, TestType
from app.models.instrument import Instrument


class ComplianceError(Exception):
    pass


@dataclass
class EngineResult:
    calculated_values: dict
    criterion_display: str
    result: str  # "PASS" | "FAIL"
    rule: Rule


# ---------------------------------------------------------------------------
# Per-test-type calculators. Each returns (calculated_values, primary_metric)
# where primary_metric is the value checked against the rule's criterion,
# expressed in absolute units (same unit as the instrument's `e`).
# ---------------------------------------------------------------------------

def _calc_weighing_performance(payload: dict) -> tuple[dict, float]:
    reference = float(payload["reference_mass"])
    indicated = float(payload["indicated_value"])
    error = round(indicated - reference, 6)
    return (
        {"reference_mass": reference, "indicated_value": indicated,
         "error": error, "unit": payload.get("unit", "kg")},
        abs(error),
    )


def _calc_repeatability(payload: dict) -> tuple[dict, float]:
    trials = [float(t) for t in payload["trials"]]
    if len(trials) < 2:
        raise ComplianceError("Repeatability test requires at least 2 trials")
    lo, hi = min(trials), max(trials)
    variation = round(hi - lo, 6)
    return (
        {"trials": trials, "minimum": lo, "maximum": hi, "variation": variation,
         "unit": payload.get("unit", "kg")},
        variation,
    )


def _calc_eccentricity(payload: dict) -> tuple[dict, float]:
    # positions: {"A": {...}, "B": {...}, "C": {...}, "D": {...}, "Center": {...}}
    positions = payload["positions"]
    per_position = {}
    max_abs_error = 0.0
    for pos, vals in positions.items():
        reference = float(vals["reference_mass"])
        indicated = float(vals["indicated_value"])
        error = round(indicated - reference, 6)
        per_position[pos] = {"reference_mass": reference, "indicated_value": indicated, "error": error}
        max_abs_error = max(max_abs_error, abs(error))
    return (
        {"positions": per_position, "max_abs_error": round(max_abs_error, 6),
         "unit": payload.get("unit", "kg")},
        max_abs_error,
    )


def _calc_zero(payload: dict) -> tuple[dict, float]:
    initial_zero = float(payload["initial_zero"])
    final_zero = float(payload["final_zero"])
    deviation = round(final_zero - initial_zero, 6)
    return (
        {"initial_zero": initial_zero, "loaded_condition": payload.get("loaded_condition"),
         "unloaded_condition": payload.get("unloaded_condition"), "final_zero": final_zero,
         "deviation": deviation, "unit": payload.get("unit", "kg")},
        abs(deviation),
    )


def _calc_tare(payload: dict) -> tuple[dict, float]:
    gross = float(payload["gross_weight"])
    tare = float(payload["tare_weight"])
    expected_net = float(payload["expected_net"])
    actual_net = round(gross - tare, 6)
    error = round(actual_net - expected_net, 6)
    return (
        {"gross_weight": gross, "tare_weight": tare, "actual_net": actual_net,
         "expected_net": expected_net, "error": error, "unit": payload.get("unit", "kg")},
        abs(error),
    )


CALCULATORS = {
    "weighing_performance": _calc_weighing_performance,
    "repeatability": _calc_repeatability,
    "eccentricity": _calc_eccentricity,
    "zero": _calc_zero,
    "tare": _calc_tare,
}


def find_applicable_rule(db: Session, standard_version_id: int, test_type_code: str, instrument_class: str) -> Rule:
    test_type = db.query(TestType).filter(TestType.code == test_type_code).first()
    if not test_type:
        raise ComplianceError(f"Unknown test type '{test_type_code}'")

    rule = (
        db.query(Rule)
        .filter(
            Rule.standard_version_id == standard_version_id,
            Rule.test_type_id == test_type.id,
            Rule.instrument_class.in_([instrument_class, "ANY"]),
        )
        .order_by(Rule.instrument_class == "ANY")  # prefer exact class match over ANY
        .first()
    )
    if not rule:
        raise ComplianceError(
            f"No rule configured for test type '{test_type_code}', "
            f"instrument class '{instrument_class}', standard version {standard_version_id}"
        )
    return rule


def evaluate_criterion(rule: Rule, primary_metric: float, e_value: float) -> tuple[bool, str]:
    """Returns (passed, human_readable_criterion_text)."""
    params = rule.criterion_params or {}

    if rule.criterion_type in ("max_abs_error_in_e", "max_variation_in_e"):
        multiplier = float(params.get("multiplier", 1.0))
        limit = round(multiplier * e_value, 6)
        passed = primary_metric <= limit
        label = "|Error|" if rule.criterion_type == "max_abs_error_in_e" else "Variation"
        return passed, f"{label} <= {multiplier} e ({limit} {rule.unit if rule.unit != 'e' else 'units'})"

    if rule.criterion_type == "max_deviation_value":
        limit = float(params.get("max_value"))
        passed = primary_metric <= limit
        return passed, f"Deviation <= {limit}"

    raise ComplianceError(f"Unknown criterion_type '{rule.criterion_type}' on rule {rule.rule_code}")


def run_compliance_check(
    db: Session,
    instrument: Instrument,
    standard_version_id: int,
    test_type_code: str,
    payload: dict,
) -> EngineResult:
    if test_type_code not in CALCULATORS:
        raise ComplianceError(f"No calculator implemented for test type '{test_type_code}'")

    calculated_values, primary_metric = CALCULATORS[test_type_code](payload)

    rule = find_applicable_rule(db, standard_version_id, test_type_code, instrument.accuracy_class)
    e_value = float(instrument.verification_scale_interval)

    passed, criterion_display = evaluate_criterion(rule, primary_metric, e_value)

    return EngineResult(
        calculated_values=calculated_values,
        criterion_display=criterion_display,
        result="PASS" if passed else "FAIL",
        rule=rule,
    )
