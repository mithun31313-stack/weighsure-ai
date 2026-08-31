from pydantic import BaseModel
from datetime import datetime


class AttachmentOut(BaseModel):
    id: int
    test_id: int
    category: str
    filename: str
    file_size_bytes: int | None = None
    uploaded_by_id: int
    uploaded_at: datetime

    class Config:
        from_attributes = True
