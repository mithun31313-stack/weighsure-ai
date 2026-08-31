from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.user import User, RoleEnum
from app.models.instrument import Instrument
from app.models.test import Test, Observation, TestResult, TestStatus
from app.models.rules import TestType
from app.models.report import AuditLog
from app.schemas.test import TestCreate, TestOut, ObservationSubmit, TestResultOut, StatusUpdate
from app.services.compliance_engine import run_compliance_check, ComplianceError

router = APIRouter(prefix="/api/tests", tags=["tests"])

# Allowed workflow transitions. Key = current status, value = set of statuses it may move to.
TRANSITIONS = {
    TestStatus.DRAFT: {TestStatus.IN_PROGRESS},
    TestStatus.IN_PROGRESS: {TestStatus.COMPLETED},
    TestStatus.COMPLETED: {TestStatus.UNDER_REVIEW},
    TestStatus.UNDER_REVIEW: {TestStatus.APPROVED, TestStatus.REJECTED},
    TestStatus.APPROVED: {TestStatus.FINALIZED},
    TestStatus.REJECTED: {TestStatus.IN_PROGRESS},  # sent back for retest
    TestStatus.FINALIZED: set(),
}

# Which role may perform which transition (by target status)
ROLE_FOR_TARGET = {
    TestStatus.IN_PROGRESS: {RoleEnum.TEST_ENGINEER, RoleEnum.ADMIN},
    TestStatus.COMPLETED: {RoleEnum.TEST_ENGINEER, RoleEnum.ADMIN},
    TestStatus.UNDER_REVIEW: {RoleEnum.TEST_ENGINEER, RoleEnum.ADMIN},
    TestStatus.APPROVED: {RoleEnum.REVIEWER, RoleEnum.ADMIN},
    TestStatus.REJECTED: {RoleEnum.REVIEWER, RoleEnum.ADMIN},
    TestStatus.FINALIZED: {RoleEnum.REVIEWER, RoleEnum.ADMIN},
}


def _next_test_code(db: Session) -> str:
    year = datetime.now(timezone.utc).year
    count = db.query(Test).count() + 1
    return f"TST-{year}-{count:04d}"


@router.post("", response_model=TestOut)
def create_test(
    payload: TestCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(RoleEnum.TEST_ENGINEER.value, RoleEnum.ADMIN.value)),
):
    instrument = db.query(Instrument).filter(Instrument.id == payload.instrument_id).first()
    if not instrument:
        raise HTTPException(status_code=404, detail="Instrument not found")

    test = Test(
        test_code=_next_test_code(db),
        instrument_id=payload.instrument_id,
        standard_version_id=payload.standard_version_id,
        engineer_id=user.id,
        test_date=payload.test_date,
        environmental_conditions=payload.environmental_conditions,
        reference_equipment=payload.reference_equipment,
        status=TestStatus.DRAFT,
    )
    db.add(test)
    db.commit()
    db.refresh(test)

    db.add(AuditLog(actor_id=user.id, action="test.created", entity_type="test", entity_id=test.id))
    db.commit()
    return test


@router.get("", response_model=list[TestOut])
def list_tests(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(Test).order_by(Test.created_at.desc()).all()


@router.get("/{test_id}", response_model=TestOut)
def get_test(test_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    test = db.query(Test).filter(Test.id == test_id).first()
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    return test


@router.post("/{test_id}/observations", response_model=TestResultOut)
def submit_observation(
    test_id: int,
    payload: ObservationSubmit,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(RoleEnum.TEST_ENGINEER.value, RoleEnum.ADMIN.value)),
):
    """
    Record an observation for a test module and immediately run it through the
    ComplianceEngine. The engine — not this endpoint, not the frontend — decides
    PASS/FAIL.
    """
    test = db.query(Test).filter(Test.id == test_id).first()
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    if test.status not in (TestStatus.DRAFT, TestStatus.IN_PROGRESS):
        raise HTTPException(status_code=400, detail=f"Cannot add observations while test is {test.status.value}")

    test_type = db.query(TestType).filter(TestType.code == payload.test_type_code).first()
    if not test_type:
        raise HTTPException(status_code=400, detail=f"Unknown test_type_code '{payload.test_type_code}'")

    observation = Observation(
        test_id=test.id, test_type_id=test_type.id,
        payload=payload.payload, recorded_by_id=user.id,
    )
    db.add(observation)
    db.commit()
    db.refresh(observation)

    try:
        engine_result = run_compliance_check(
            db=db,
            instrument=test.instrument,
            standard_version_id=test.standard_version_id,
            test_type_code=payload.test_type_code,
            payload=payload.payload,
        )
    except ComplianceError as e:
        raise HTTPException(status_code=400, detail=str(e))

    result = TestResult(
        test_id=test.id,
        observation_id=observation.id,
        rule_id=engine_result.rule.id,
        calculated_values=engine_result.calculated_values,
        criterion_display=engine_result.criterion_display,
        result=engine_result.result,
    )
    db.add(result)

    if test.status == TestStatus.DRAFT:
        test.status = TestStatus.IN_PROGRESS

    db.add(AuditLog(
        actor_id=user.id, action="observation.added", entity_type="test", entity_id=test.id,
        details={"test_type": payload.test_type_code, "result": engine_result.result,
                 "rule_code": engine_result.rule.rule_code},
    ))
    db.commit()
    db.refresh(result)
    return result


@router.get("/{test_id}/results", response_model=list[TestResultOut])
def get_test_results(test_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(TestResult).filter(TestResult.test_id == test_id).all()


@router.post("/{test_id}/status", response_model=TestOut)
def update_status(
    test_id: int, payload: StatusUpdate,
    db: Session = Depends(get_db), user: User = Depends(get_current_user),
):
    test = db.query(Test).filter(Test.id == test_id).first()
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")

    try:
        target = TestStatus(payload.status)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid status value")

    if target not in TRANSITIONS.get(test.status, set()):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot move from {test.status.value} to {target.value}",
        )
    allowed_roles = ROLE_FOR_TARGET.get(target, set())
    if user.role not in allowed_roles:
        raise HTTPException(status_code=403, detail=f"Role {user.role.value} cannot set status to {target.value}")

    if target == TestStatus.APPROVED:
        test.reviewer_id = user.id
    if payload.comments:
        test.reviewer_comments = payload.comments

    test.status = target
    db.commit()
    db.refresh(test)

    if target == TestStatus.UNDER_REVIEW:
        from app.services.notifications import notify_reviewers_pending
        notify_reviewers_pending(db, test)

    db.add(AuditLog(actor_id=user.id, action=f"test.status.{target.value.lower()}",
                     entity_type="test", entity_id=test.id))
    db.commit()
    return test
