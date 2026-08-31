"""
Report Generator
=================
Builds the professional OIML R 76 test report PDF (Section 12 of spec),
generates a QR code linking to the public verification page (Section 14),
and computes a tamper-detection hash (Section 15).

The PDF is generated ENTIRELY from data already decided elsewhere:
- Compliance results come from TestResult rows (ComplianceEngine's output)
- Nothing here makes or alters a PASS/FAIL decision
"""
import hashlib
import json
import os
from datetime import datetime, timezone

import qrcode
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, PageBreak, HRFlowable,
)
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.test import Test, TestResult
from app.models.report import Report, Attachment, VerificationRecord, AuditLog

REPORTS_DIR = os.path.join(settings.UPLOAD_DIR, "reports")
os.makedirs(REPORTS_DIR, exist_ok=True)


def _next_report_id(db: Session) -> str:
    year = datetime.now(timezone.utc).year
    count = db.query(Report).count() + 1
    return f"OIML-{year}-{count:06d}"


def _hashable_snapshot(test: Test, results: list[TestResult], report_id: str, overall_result: str) -> dict:
    """The exact fields covered by the tamper-detection hash."""
    return {
        "report_id": report_id,
        "test_code": test.test_code,
        "instrument_serial": test.instrument.serial_number,
        "standard_version_id": test.standard_version_id,
        "overall_result": overall_result,
        "results": sorted(
            [
                {"result_id": r.id, "rule_id": r.rule_id, "result": r.result,
                 "calculated_values": r.calculated_values}
                for r in results
            ],
            key=lambda x: x["result_id"],
        ),
    }


def compute_hash(snapshot: dict) -> str:
    canonical = json.dumps(snapshot, sort_keys=True, default=str)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _styles():
    ss = getSampleStyleSheet()
    ss.add(ParagraphStyle(name="SectionHeading", parent=ss["Heading2"],
                           textColor=colors.HexColor("#1e3a5f"), spaceBefore=14, spaceAfter=6))
    ss.add(ParagraphStyle(name="TitleMain", parent=ss["Title"],
                           textColor=colors.HexColor("#1e3a5f"), fontSize=22))
    ss.add(ParagraphStyle(name="TaglineStyle", parent=ss["Normal"],
                           alignment=1, textColor=colors.HexColor("#5a6b7d"), fontSize=10))
    ss.add(ParagraphStyle(name="ResultBig", parent=ss["Title"], fontSize=28, alignment=1))
    return ss


def _kv_table(rows: list[tuple[str, str]]) -> Table:
    t = Table([[Paragraph(f"<b>{k}</b>", getSampleStyleSheet()["Normal"]), str(v)] for k, v in rows],
              colWidths=[55 * mm, 110 * mm])
    t.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("LINEBELOW", (0, 0), (-1, -1), 0.4, colors.HexColor("#dfe6ec")),
    ]))
    return t


def generate_report_pdf(db: Session, test: Test) -> Report:
    """
    Generates the PDF + QR for a FINALIZED-eligible test, creates Report,
    VerificationRecord, and AuditLog rows. Returns the Report ORM object.
    """
    results = db.query(TestResult).filter(TestResult.test_id == test.id).all()
    if not results:
        raise ValueError("Cannot generate a report for a test with no results")

    overall_result = "PASS" if all(r.result == "PASS" for r in results) else "FAIL"
    report_id = _next_report_id(db)

    instrument = test.instrument
    laboratory = instrument.laboratory
    engineer = test.engineer if hasattr(test, "engineer") else None
    attachments = db.query(Attachment).filter(Attachment.test_id == test.id).all()
    audit_rows = (
        db.query(AuditLog)
        .filter(AuditLog.entity_type == "test", AuditLog.entity_id == test.id)
        .order_by(AuditLog.created_at.asc())
        .all()
    )

    is_demo_standard = getattr(test.standard_version, "is_demo", True)

    # ---- QR code -> public verification URL ----
    verify_url = f"{settings.PUBLIC_VERIFY_BASE_URL}/{report_id}"
    qr_img = qrcode.make(verify_url)
    qr_path = os.path.join(REPORTS_DIR, f"{report_id}-qr.png")
    qr_img.save(qr_path)

    # ---- Build PDF ----
    pdf_path = os.path.join(REPORTS_DIR, f"{report_id}.pdf")
    doc = SimpleDocTemplate(pdf_path, pagesize=A4,
                             topMargin=18 * mm, bottomMargin=18 * mm,
                             leftMargin=18 * mm, rightMargin=18 * mm)
    ss = _styles()
    story = []

    # Header (1)
    story.append(Paragraph("WeighSure AI", ss["TitleMain"]))
    story.append(Paragraph("Smart Testing. Accurate Compliance. Trusted Reports.", ss["TaglineStyle"]))
    story.append(Spacer(1, 4))
    story.append(Paragraph("OIML R 76 NAWI TEST REPORT", ss["Heading1"]))
    if is_demo_standard:
        story.append(Paragraph(
            "<font color='#b45309'><b>DEMO DATA NOTICE:</b> This report uses a demo/sample rule set "
            "for hackathon demonstration. Acceptance criteria shown are NOT validated official OIML R 76 "
            "legal limits.</font>", ss["Normal"]))
    story.append(HRFlowable(width="100%", color=colors.HexColor("#1e3a5f"), thickness=1))
    story.append(Spacer(1, 8))

    # 1. Report Identification
    story.append(Paragraph("1. Report Identification", ss["SectionHeading"]))
    story.append(_kv_table([
        ("Report ID", report_id),
        ("Test Code", test.test_code),
        ("Report Generated", datetime.now(timezone.utc).strftime("%d-%m-%Y %H:%M UTC")),
    ]))

    # 2. Laboratory Details
    story.append(Paragraph("2. Laboratory Details", ss["SectionHeading"]))
    story.append(_kv_table([
        ("Laboratory", laboratory.name if laboratory else "-"),
        ("Accreditation No.", getattr(laboratory, "accreditation_no", "-") or "-"),
        ("Address", getattr(laboratory, "address", "-") or "-"),
    ]))

    # 3-4. Instrument & Manufacturer Details
    story.append(Paragraph("3. Instrument Details", ss["SectionHeading"]))
    story.append(_kv_table([
        ("Instrument Code", instrument.instrument_code),
        ("Manufacturer", instrument.manufacturer),
        ("Model", instrument.model),
        ("Serial Number", instrument.serial_number),
        ("Instrument Type", instrument.instrument_type),
        ("Accuracy Class", instrument.accuracy_class),
        ("Max Capacity", f"{instrument.max_capacity}"),
        ("Min Capacity", f"{instrument.min_capacity}"),
        ("Verification Scale Interval (e)", f"{instrument.verification_scale_interval}"),
        ("Owner / Customer", instrument.owner_customer or "-"),
    ]))

    # 5. Test Engineer
    story.append(Paragraph("5. Test Engineer", ss["SectionHeading"]))
    story.append(_kv_table([
        ("Engineer", test.engineer.full_name if test.engineer else "-"),
        ("Reviewer", test.reviewer.full_name if test.reviewer else "Pending"),
    ]))

    # 6-8. Test Date, Environmental Conditions, Reference Equipment
    story.append(Paragraph("6-8. Test Conditions", ss["SectionHeading"]))
    env = test.environmental_conditions or {}
    story.append(_kv_table([
        ("Test Date", test.test_date.strftime("%d-%m-%Y %H:%M")),
        ("Environmental Conditions", ", ".join(f"{k}: {v}" for k, v in env.items()) or "Not recorded"),
        ("Reference Equipment", test.reference_equipment or "Not recorded"),
    ]))

    # 9. Applicable Standard
    story.append(Paragraph("9. Applicable Standard and Version", ss["SectionHeading"]))
    story.append(_kv_table([
        ("Standard", test.standard_version.standard.name),
        ("Version", test.standard_version.version_label),
        ("Demo / Validated", "DEMO — not legally validated" if is_demo_standard else "Validated"),
    ]))

    # 10-14. Test Procedures, Raw Observations, Calculations, Criteria, Results
    story.append(Spacer(1, 10))
    story.append(Paragraph("10-14. Test Results", ss["SectionHeading"]))
    result_rows = [["Test Type", "Rule", "Calculated Values", "Criterion", "Result"]]
    for r in results:
        result_rows.append([
            Paragraph(r.rule.test_type.name, ss["Normal"]),
            r.rule.rule_code,
            Paragraph(", ".join(f"{k}: {v}" for k, v in r.calculated_values.items()), ss["Normal"]),
            Paragraph(r.criterion_display, ss["Normal"]),
            r.result,
        ])
    results_table = Table(result_rows, colWidths=[32*mm, 22*mm, 50*mm, 40*mm, 20*mm], repeatRows=1)
    style_cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e3a5f")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#dfe6ec")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]
    for i, r in enumerate(results, start=1):
        color = colors.HexColor("#dcfce7") if r.result == "PASS" else colors.HexColor("#fee2e2")
        style_cmds.append(("BACKGROUND", (4, i), (4, i), color))
    results_table.setStyle(TableStyle(style_cmds))
    story.append(results_table)

    # 15. Graphs — placeholder note (chart rendering is a frontend concern; data is in results table above)
    story.append(Spacer(1, 10))
    story.append(Paragraph("15. Graphs", ss["SectionHeading"]))
    story.append(Paragraph(
        "Graphical trend and comparison charts for this test are available in the WeighSure AI "
        "dashboard. Raw values used to generate them are listed in Section 10-14 above.", ss["Normal"]))

    # 16. Test Photographs
    story.append(Paragraph("16. Test Photographs", ss["SectionHeading"]))
    if attachments:
        for att in attachments:
            label = att.category.replace("_", " ").title()
            story.append(Paragraph(f"<b>{label}</b> — {att.filename}", ss["Normal"]))
            if os.path.splitext(att.stored_path)[1].lower() in (".jpg", ".jpeg", ".png", ".webp"):
                try:
                    story.append(Image(att.stored_path, width=70 * mm, height=52 * mm))
                except Exception:
                    story.append(Paragraph("(image could not be rendered)", ss["Normal"]))
            story.append(Spacer(1, 6))
    else:
        story.append(Paragraph("No photographs were attached to this test.", ss["Normal"]))

    # 17. Remarks
    story.append(Paragraph("17. Remarks", ss["SectionHeading"]))
    story.append(Paragraph(test.reviewer_comments or instrument.remarks or "None recorded.", ss["Normal"]))

    # 18. Overall Result
    story.append(Spacer(1, 10))
    story.append(Paragraph("18. Overall Result", ss["SectionHeading"]))
    result_color = colors.HexColor("#15803d") if overall_result == "PASS" else colors.HexColor("#b91c1c")
    overall_style = ParagraphStyle(name="Overall", parent=ss["ResultBig"], textColor=result_color)
    story.append(Paragraph(overall_result, overall_style))

    # 19-20. Reviewer Approval & Signature placeholder
    story.append(Spacer(1, 10))
    story.append(Paragraph("19-20. Reviewer Approval & Signature", ss["SectionHeading"]))
    story.append(_kv_table([
        ("Reviewer", test.reviewer.full_name if test.reviewer else "Pending"),
        ("Status", test.status.value),
        ("Signature", "[ Digital signature placeholder — not cryptographically signed in this MVP ]"),
    ]))

    # 21. QR Verification
    story.append(Spacer(1, 10))
    story.append(Paragraph("21. QR Verification", ss["SectionHeading"]))
    story.append(Image(qr_path, width=30 * mm, height=30 * mm))
    story.append(Paragraph(f"Scan to verify, or visit: {verify_url}", ss["Normal"]))

    # 22. Audit Information
    story.append(PageBreak())
    story.append(Paragraph("22. Audit Information", ss["SectionHeading"]))
    if audit_rows:
        audit_table_rows = [["Timestamp (UTC)", "Action"]]
        for a in audit_rows:
            audit_table_rows.append([a.created_at.strftime("%d-%m-%Y %H:%M"), a.action])
        at = Table(audit_table_rows, colWidths=[45 * mm, 120 * mm], repeatRows=1)
        at.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e3a5f")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#dfe6ec")),
        ]))
        story.append(at)
    else:
        story.append(Paragraph("No audit events recorded.", ss["Normal"]))

    doc.build(story)

    # ---- Tamper-detection hash ----
    snapshot = _hashable_snapshot(test, results, report_id, overall_result)
    report_hash = compute_hash(snapshot)

    report = Report(
        report_id=report_id, test_id=test.id, overall_result=overall_result,
        pdf_path=pdf_path, qr_path=qr_path, report_hash=report_hash,
        finalized_by_id=test.reviewer_id, finalized_at=datetime.now(timezone.utc),
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    db.add(VerificationRecord(
        report_id=report_id,
        instrument_summary=f"{instrument.manufacturer} {instrument.model}",
        serial_number=instrument.serial_number,
        test_date=test.test_date,
        standard_label=f"{test.standard_version.standard.name} ({test.standard_version.version_label})",
        overall_result=overall_result,
        issuing_laboratory=laboratory.name if laboratory else "-",
    ))
    db.add(AuditLog(actor_id=test.reviewer_id, action="report.generated",
                     entity_type="report", entity_id=report.id,
                     details={"report_id": report_id}))
    db.commit()

    return report


def tamper_check(db: Session, report: Report) -> bool:
    """Recomputes the hash from current DB state and compares to the stored hash."""
    test = db.query(Test).filter(Test.id == report.test_id).first()
    results = db.query(TestResult).filter(TestResult.test_id == report.test_id).all()
    snapshot = _hashable_snapshot(test, results, report.report_id, report.overall_result)
    current_hash = compute_hash(snapshot)
    return current_hash == report.report_hash
