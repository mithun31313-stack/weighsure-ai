from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.rules import Standard, StandardVersion, TestType

router = APIRouter(prefix="/api/standards", tags=["standards"])


class StandardVersionOut(BaseModel):
    id: int
    standard_name: str
    version_label: str
    is_demo: bool

    class Config:
        from_attributes = True


class TestTypeOut(BaseModel):
    id: int
    code: str
    name: str

    class Config:
        from_attributes = True


@router.get("/versions", response_model=list[StandardVersionOut])
def list_versions(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.query(StandardVersion).join(Standard).all()
    return [
        StandardVersionOut(id=r.id, standard_name=r.standard.name, version_label=r.version_label, is_demo=r.is_demo)
        for r in rows
    ]


@router.get("/test-types", response_model=list[TestTypeOut])
def list_test_types(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(TestType).all()
