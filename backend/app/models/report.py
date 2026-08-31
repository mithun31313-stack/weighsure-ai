from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, JSON, BigInteger
from sqlalchemy.orm import relationship
from app.core.database import Base


class Attachment(Base):
    __tablename__ = "attachments"

    id = Column(Integer, primary_key=True)
    test_id = Column(Integer, ForeignKey("tests.id"), nullable=False)
    category = Column(String(50), nullable=False)  # instrument_photo, nameplate, setup, load_placement, document
    filename = Column(String(255), nullable=False)
    stored_path = Column(String(500), nullable=False)
    file_hash = Column(String(128), nullable=False)
    file_size_bytes = Column(BigInteger, nullable=True)
    uploaded_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    test = relationship("Test", back_populates="attachments")


class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True)
    report_id = Column(String(50), unique=True, nullable=False)  # e.g. OIML-2026-000123
    test_id = Column(Integer, ForeignKey("tests.id"), nullable=False)
    overall_result = Column(String(10), nullable=False)  # PASS / FAIL
    pdf_path = Column(String(500), nullable=True)
    qr_path = Column(String(500), nullable=True)
    report_hash = Column(String(128), nullable=True)  # for tamper detection
    finalized_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    finalized_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    test = relationship("Test")
    signatures = relationship("Signature", back_populates="report")


class Signature(Base):
    __tablename__ = "signatures"

    id = Column(Integer, primary_key=True)
    report_id = Column(Integer, ForeignKey("reports.id"), nullable=False)
    signer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    signer_role = Column(String(30), nullable=False)
    signed_at = Column(DateTime, default=datetime.utcnow)
    signature_note = Column(String(300), nullable=True)  # placeholder, no real crypto signing in MVP

    report = relationship("Report", back_populates="signatures")


class VerificationRecord(Base):
    """Public-safe snapshot shown at /verify/{report_id}."""
    __tablename__ = "verification_records"

    id = Column(Integer, primary_key=True)
    report_id = Column(String(50), ForeignKey("reports.report_id"), unique=True, nullable=False)
    instrument_summary = Column(String(300), nullable=False)
    serial_number = Column(String(100), nullable=False)
    test_date = Column(DateTime, nullable=False)
    standard_label = Column(String(100), nullable=False)
    overall_result = Column(String(10), nullable=False)
    issuing_laboratory = Column(String(200), nullable=False)
    verification_status = Column(String(20), default="AUTHENTIC")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True)
    actor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String(150), nullable=False)  # e.g. "test.created", "report.finalized"
    entity_type = Column(String(50), nullable=True)
    entity_id = Column(Integer, nullable=True)
    details = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
