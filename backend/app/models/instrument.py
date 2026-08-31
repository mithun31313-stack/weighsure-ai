from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Numeric
from sqlalchemy.orm import relationship
from app.core.database import Base


class Instrument(Base):
    __tablename__ = "instruments"

    id = Column(Integer, primary_key=True)
    instrument_code = Column(String(50), unique=True, nullable=False)  # e.g. INS-2026-0001
    manufacturer = Column(String(150), nullable=False)
    model = Column(String(100), nullable=False)
    serial_number = Column(String(100), unique=True, nullable=False)
    instrument_type = Column(String(100), nullable=False)  # e.g. platform scale
    accuracy_class = Column(String(10), nullable=False)  # I, II, III, IIII
    max_capacity = Column(Numeric(12, 3), nullable=False)
    min_capacity = Column(Numeric(12, 3), nullable=False)
    verification_scale_interval = Column(Numeric(12, 5), nullable=False)  # "e"
    display_resolution = Column(Numeric(12, 5), nullable=True)
    owner_customer = Column(String(200), nullable=True)
    date_received = Column(DateTime, nullable=True)
    date_of_test = Column(DateTime, nullable=True)
    laboratory_id = Column(Integer, ForeignKey("laboratories.id"), nullable=False)
    remarks = Column(Text, nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    laboratory = relationship("Laboratory", back_populates="instruments")
    history = relationship("InstrumentHistory", back_populates="instrument")
    tests = relationship("Test", back_populates="instrument")


class InstrumentHistory(Base):
    __tablename__ = "instrument_history"

    id = Column(Integer, primary_key=True)
    instrument_id = Column(Integer, ForeignKey("instruments.id"), nullable=False)
    changed_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    change_summary = Column(Text, nullable=False)
    changed_at = Column(DateTime, default=datetime.utcnow)

    instrument = relationship("Instrument", back_populates="history")
