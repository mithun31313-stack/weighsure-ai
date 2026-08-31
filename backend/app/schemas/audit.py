from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime


class AuditLogOut(BaseModel):
    id: int
    actor_id: Optional[int] = None
    action: str
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    details: Optional[Any] = None
    created_at: datetime

    class Config:
        from_attributes = True
