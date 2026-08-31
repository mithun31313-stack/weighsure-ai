from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class InstrumentCreate(BaseModel):
    manufacturer: str
    model: str
    serial_number: str
    instrument_type: str
    accuracy_class: str
    max_capacity: float
    min_capacity: float
    verification_scale_interval: float
    display_resolution: Optional[float] = None
    owner_customer: Optional[str] = None
    date_received: Optional[datetime] = None
    date_of_test: Optional[datetime] = None
    remarks: Optional[str] = None


class InstrumentUpdate(BaseModel):
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    instrument_type: Optional[str] = None
    accuracy_class: Optional[str] = None
    max_capacity: Optional[float] = None
    min_capacity: Optional[float] = None
    verification_scale_interval: Optional[float] = None
    display_resolution: Optional[float] = None
    owner_customer: Optional[str] = None
    date_of_test: Optional[datetime] = None
    remarks: Optional[str] = None


class InstrumentOut(BaseModel):
    id: int
    instrument_code: str
    manufacturer: str
    model: str
    serial_number: str
    instrument_type: str
    accuracy_class: str
    max_capacity: float
    min_capacity: float
    verification_scale_interval: float
    display_resolution: Optional[float] = None
    owner_customer: Optional[str] = None
    laboratory_id: int
    remarks: Optional[str] = None
    date_of_test: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class InstrumentHistoryOut(BaseModel):
    id: int
    change_summary: str
    changed_at: datetime
    changed_by_id: int

    class Config:
        from_attributes = True
