import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Enum, JSON, Numeric
from sqlalchemy.orm import relationship
from app.core.database import Base


class TestStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    UNDER_REVIEW = "UNDER_REVIEW"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    FINALIZED = "FINALIZED"


class Test(Base):
    __tablename__ = "tests"

    id = Column(Integer, primary_key=True)
    test_code = Column(String(50), unique=True, nullable=False)  # e.g. TST-2026-0001
    instrument_id = Column(Integer, ForeignKey("instruments.id"), nullable=False)
    standard_version_id = Column(Integer, ForeignKey("standard_versions.id"), nullable=False)
    engineer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    reviewer_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    test_date = Column(DateTime, nullable=False)
    environmental_conditions = Column(JSON, nullable=True)  # {temp_c, humidity_pct, notes}
    reference_equipment = Column(String(300), nullable=True)

    status = Column(Enum(TestStatus), default=TestStatus.DRAFT, nullable=False)
    reviewer_comments = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    instrument = relationship("Instrument", back_populates="tests")
    standard_version = relationship("StandardVersion")
    engineer = relationship("User", foreign_keys=[engineer_id])
    reviewer = relationship("User", foreign_keys=[reviewer_id])
    observations = relationship("Observation", back_populates="test")
    results = relationship("TestResult", back_populates="test")
    attachments = relationship("Attachment", back_populates="test")


class Observation(Base):
    """
    Raw input data for a given test-type module within a test.
    `payload` shape depends on test_type (weighing_performance, repeatability,
    eccentricity, zero, tare) — validated by the module's schema before save.
    """
    __tablename__ = "observations"

    id = Column(Integer, primary_key=True)
    test_id = Column(Integer, ForeignKey("tests.id"), nullable=False)
    test_type_id = Column(Integer, ForeignKey("test_types.id"), nullable=False)
    payload = Column(JSON, nullable=False)
    recorded_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    recorded_at = Column(DateTime, default=datetime.utcnow)

    test = relationship("Test", back_populates="observations")
    test_type = relationship("TestType")


class TestResult(Base):
    """
    Output of the ComplianceEngine for one observation. This is the
    authoritative, traceable PASS/FAIL record — never computed client-side.
    """
    __tablename__ = "test_results"

    id = Column(Integer, primary_key=True)
    test_id = Column(Integer, ForeignKey("tests.id"), nullable=False)
    observation_id = Column(Integer, ForeignKey("observations.id"), nullable=False)
    rule_id = Column(Integer, ForeignKey("rules.id"), nullable=False)

    calculated_values = Column(JSON, nullable=False)  # e.g. {"error": 0.02, "unit": "kg"}
    criterion_display = Column(String(300), nullable=False)
    result = Column(String(10), nullable=False)  # PASS / FAIL
    explanation = Column(Text, nullable=True)

    calculated_at = Column(DateTime, default=datetime.utcnow)

    test = relationship("Test", back_populates="results")
    rule = relationship("Rule")

    @property
    def test_type_code(self) -> str | None:
        return self.rule.test_type.code if self.rule and self.rule.test_type else None
