"""
Seed demo data for local development / hackathon demo.
Run with: python -m app.seed
"""
from datetime import datetime, timezone

from app.core.database import Base, engine, SessionLocal
from app.core.security import hash_password
from app import models
from app.models.user import User, Laboratory, RoleEnum
from app.models.instrument import Instrument
from app.models.rules import Standard, StandardVersion, TestType, Rule

Base.metadata.create_all(bind=engine)
db = SessionLocal()

def get_or_create(model, defaults=None, **kwargs):
    instance = db.query(model).filter_by(**kwargs).first()
    if instance:
        return instance, False
    params = {**kwargs, **(defaults or {})}
    instance = model(**params)
    db.add(instance)
    db.commit()
    db.refresh(instance)
    return instance, True


def run():
    lab, _ = get_or_create(
        Laboratory, name="WeighSure AI Demo Laboratory",
        defaults={"accreditation_no": "DEMO-LAB-001", "address": "Coimbatore, TN, India"},
    )

    admin, _ = get_or_create(
        User, email="admin@weighsure.ai",
        defaults=dict(full_name="Lab Admin", hashed_password=hash_password("Admin@123"),
                      role=RoleEnum.ADMIN, laboratory_id=lab.id),
    )
    engineer, _ = get_or_create(
        User, email="engineer@weighsure.ai",
        defaults=dict(full_name="Test Engineer", hashed_password=hash_password("Engineer@123"),
                      role=RoleEnum.TEST_ENGINEER, laboratory_id=lab.id),
    )
    reviewer, _ = get_or_create(
        User, email="reviewer@weighsure.ai",
        defaults=dict(full_name="Report Reviewer", hashed_password=hash_password("Reviewer@123"),
                      role=RoleEnum.REVIEWER, laboratory_id=lab.id),
    )

    standard, _ = get_or_create(Standard, name="OIML R 76",
                                 defaults={"description": "Non-Automatic Weighing Instruments"})
    version, _ = get_or_create(
        StandardVersion, standard_id=standard.id, version_label="DEMO",
        defaults={"is_demo": True, "published_year": None,
                  "notes": "DEMO rule set for hackathon purposes only — NOT validated OIML values."},
    )

    test_types = {}
    for code, name in [
        ("weighing_performance", "Weighing Performance Test"),
        ("repeatability", "Repeatability Test"),
        ("eccentricity", "Eccentricity Test"),
        ("zero", "Zero Test"),
        ("tare", "Tare Test"),
    ]:
        tt, _ = get_or_create(TestType, code=code, defaults={"name": name})
        test_types[code] = tt

    # DEMO rules — clearly labelled, not official OIML R 76 values.
    demo_rules = [
        dict(rule_code="DEMO-R76-001", test_type_id=test_types["weighing_performance"].id,
             instrument_class="III", condition_description="Demo band: any load within capacity",
             criterion_type="max_abs_error_in_e", criterion_params={"multiplier": 1.0},
             unit="e", source_reference="DEMO - not an official OIML limit",
             notes="Placeholder until validated R76 tables are configured."),
        dict(rule_code="DEMO-R76-002", test_type_id=test_types["repeatability"].id,
             instrument_class="III", condition_description="Demo band: any load",
             criterion_type="max_variation_in_e", criterion_params={"multiplier": 1.0},
             unit="e", source_reference="DEMO - not an official OIML limit", notes=None),
        dict(rule_code="DEMO-R76-003", test_type_id=test_types["eccentricity"].id,
             instrument_class="III", condition_description="Demo: 4-corner + center load",
             criterion_type="max_abs_error_in_e", criterion_params={"multiplier": 1.5},
             unit="e", source_reference="DEMO - not an official OIML limit", notes=None),
        dict(rule_code="DEMO-R76-004", test_type_id=test_types["zero"].id,
             instrument_class="III", condition_description="Demo: zero-return deviation",
             criterion_type="max_abs_error_in_e", criterion_params={"multiplier": 0.5},
             unit="e", source_reference="DEMO - not an official OIML limit", notes=None),
        dict(rule_code="DEMO-R76-005", test_type_id=test_types["tare"].id,
             instrument_class="III", condition_description="Demo: tare deviation",
             criterion_type="max_abs_error_in_e", criterion_params={"multiplier": 1.0},
             unit="e", source_reference="DEMO - not an official OIML limit", notes=None),
    ]
    for r in demo_rules:
        get_or_create(Rule, rule_code=r["rule_code"], defaults={**r, "standard_version_id": version.id})

    instrument, _ = get_or_create(
        Instrument, serial_number="ABC2026001",
        defaults=dict(
            instrument_code="INS-2026-0001", manufacturer="ABC Weighing Systems",
            model="ABC-100", instrument_type="Platform Scale", accuracy_class="III",
            max_capacity=100.000, min_capacity=0.040, verification_scale_interval=0.020,
            display_resolution=0.020, owner_customer="ABC Industries",
            date_received=datetime.now(timezone.utc), date_of_test=datetime.now(timezone.utc),
            laboratory_id=lab.id, created_by_id=engineer.id,
            remarks="Demo instrument for SIH presentation.",
        ),
    )

    print("Seed complete.")
    print("Demo credentials:")
    print("  Admin:    admin@weighsure.ai / Admin@123")
    print("  Engineer: engineer@weighsure.ai / Engineer@123")
    print("  Reviewer: reviewer@weighsure.ai / Reviewer@123")
    print(f"Demo instrument: {instrument.model} / {instrument.serial_number}")


if __name__ == "__main__":
    run()
