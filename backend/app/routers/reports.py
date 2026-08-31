from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.user import User, RoleEnum
from app.models.test import Test, TestStatus
from app.models.report import Report, VerificationRecord, AuditLog
from app.schemas.report import ReportOut, VerificationOut
from app.services.report_generator import generate_report_pdf, tamper_check

router = APIRouter(tags=["reports"])


@router.post("/api/tests/{test_id}/finalize", response_model=ReportOut)
def finalize_test(
    test_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(RoleEnum.REVIEWER.value, RoleEnum.ADMIN.value)),
):
    test = db.query(Test).filter(Test.id == test_id).first()
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    if test.status != TestStatus.APPROVED:
        raise HTTPException(status_code=400, detail=f"Test must be APPROVED before finalizing (currently {test.status.value})")

    existing = db.query(Report).filter(Report.test_id == test.id).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Report {existing.report_id} already generated for this test")

    try:
        report = generate_report_pdf(db, test)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    test.status = TestStatus.FINALIZED
    db.add(AuditLog(actor_id=user.id, action="test.status.finalized", entity_type="test", entity_id=test.id))
    db.commit()
    db.refresh(report)
    return report


@router.get("/api/reports", response_model=list[ReportOut])
def list_reports(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(Report).order_by(Report.created_at.desc()).all()


@router.get("/api/reports/{report_id}", response_model=ReportOut)
def get_report(report_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    report = db.query(Report).filter(Report.report_id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report


@router.get("/api/reports/{report_id}/download")
def download_report(report_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    report = db.query(Report).filter(Report.report_id == report_id).first()
    if not report or not report.pdf_path:
        raise HTTPException(status_code=404, detail="Report PDF not found")
    return FileResponse(report.pdf_path, media_type="application/pdf", filename=f"{report_id}.pdf")


@router.get("/api/verify/{report_id}", response_model=VerificationOut)
def verify_report(report_id: str, db: Session = Depends(get_db)):
    """
    PUBLIC endpoint — no authentication. Exposes only verification-safe fields,
    never internal test/instrument IDs, engineer names, or raw observations.
    """
    record = db.query(VerificationRecord).filter(VerificationRecord.report_id == report_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Report ID not found or not verified")

    report = db.query(Report).filter(Report.report_id == report_id).first()
    tamper_status = "VALID"
    if report:
        tamper_status = "VALID" if tamper_check(db, report) else "FAILED"

    return VerificationOut(
        report_id=record.report_id,
        instrument_summary=record.instrument_summary,
        serial_number=record.serial_number,
        test_date=record.test_date,
        standard_label=record.standard_label,
        overall_result=record.overall_result,
        issuing_laboratory=record.issuing_laboratory,
        verification_status=record.verification_status,
        tamper_check=tamper_status,
    )
