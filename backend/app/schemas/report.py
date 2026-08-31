from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ReportOut(BaseModel):
    id: int
    report_id: str
    test_id: int
    overall_result: str
    finalized_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class VerificationOut(BaseModel):
    report_id: str
    instrument_summary: str
    serial_number: str
    test_date: datetime
    standard_label: str
    overall_result: str
    issuing_laboratory: str
    verification_status: str
    tamper_check: str  # "VALID" | "FAILED"
