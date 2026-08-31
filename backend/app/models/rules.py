from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base


class Standard(Base):
    __tablename__ = "standards"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)  # e.g. "OIML R 76"
    description = Column(Text, nullable=True)

    versions = relationship("StandardVersion", back_populates="standard")


class StandardVersion(Base):
    __tablename__ = "standard_versions"

    id = Column(Integer, primary_key=True)
    standard_id = Column(Integer, ForeignKey("standards.id"), nullable=False)
    version_label = Column(String(50), nullable=False)  # e.g. "DEMO", "1-2006"
    is_demo = Column(Boolean, default=True)  # True until officially validated values are loaded
    published_year = Column(Integer, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    standard = relationship("Standard", back_populates="versions")
    rules = relationship("Rule", back_populates="standard_version")


class TestType(Base):
    __tablename__ = "test_types"

    id = Column(Integer, primary_key=True)
    code = Column(String(50), unique=True, nullable=False)  # weighing_performance, repeatability, eccentricity, zero, tare
    name = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)


class Rule(Base):
    """
    A single, version-controlled compliance rule.
    Rules are the ONLY source of PASS/FAIL truth — the ComplianceEngine
    reads these, never hardcodes limits in code.
    """
    __tablename__ = "rules"

    id = Column(Integer, primary_key=True)
    rule_code = Column(String(50), unique=True, nullable=False)  # e.g. DEMO-R76-001
    standard_version_id = Column(Integer, ForeignKey("standard_versions.id"), nullable=False)
    test_type_id = Column(Integer, ForeignKey("test_types.id"), nullable=False)
    instrument_class = Column(String(10), nullable=False)  # I, II, III, IIII, ANY
    condition_description = Column(String(300), nullable=True)  # e.g. "0 < m <= 50000e"

    # Acceptance criterion expressed generically so the engine can evaluate it
    # without hardcoding formulas. `criterion_type` selects the evaluator.
    criterion_type = Column(String(50), nullable=False)  # "max_abs_error_in_e", "max_variation_in_e", "max_deviation_value"
    criterion_params = Column(JSON, nullable=False)  # e.g. {"multiplier": 1.0} meaning error must be <= 1.0e
    unit = Column(String(20), nullable=False, default="e")

    source_reference = Column(String(300), nullable=True)  # clause reference, or "DEMO - not validated"
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    standard_version = relationship("StandardVersion", back_populates="rules")
    test_type = relationship("TestType")


class RuleCondition(Base):
    """Optional extra structured conditions for a rule (load bands etc.)."""
    __tablename__ = "rule_conditions"

    id = Column(Integer, primary_key=True)
    rule_id = Column(Integer, ForeignKey("rules.id"), nullable=False)
    min_load_in_e = Column(Integer, nullable=True)
    max_load_in_e = Column(Integer, nullable=True)
    extra = Column(JSON, nullable=True)

    rule = relationship("Rule")


class AcceptanceCriteria(Base):
    """Human-readable rendering of a rule's criterion, cached for report display."""
    __tablename__ = "acceptance_criteria"

    id = Column(Integer, primary_key=True)
    rule_id = Column(Integer, ForeignKey("rules.id"), nullable=False)
    display_text = Column(String(300), nullable=False)  # e.g. "|Error| <= 1.0 e"

    rule = relationship("Rule")
