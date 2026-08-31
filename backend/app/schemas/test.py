from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime


class TestCreate(BaseModel):
    instrument_id: int
    standard_version_id: int
    test_date: datetime
    environmental_conditions: Optional[dict] = None
    reference_equipment: Optional[str] = None


class TestOut(BaseModel):
    id: int
    test_code: str
    instrument_id: int
    standard_version_id: int
    engineer_id: int
    reviewer_id: Optional[int] = None
    test_date: datetime
    status: str
    reviewer_comments: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ObservationSubmit(BaseModel):
    test_type_code: str  # weighing_performance | repeatability | eccentricity | zero | tare
    payload: dict[str, Any]


class TestResultOut(BaseModel):
    id: int
    observation_id: int
    rule_id: int
    test_type_code: Optional[str] = None
    calculated_values: dict
    criterion_display: str
    result: str
    calculated_at: datetime

    class Config:
        from_attributes = True


class StatusUpdate(BaseModel):
    status: str  # one of TestStatus values
    comments: Optional[str] = None
