from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import require_roles
from app.models.user import User, RoleEnum
from app.models.report import AuditLog
from app.schemas.audit import AuditLogOut

router = APIRouter(prefix="/api/audit-logs", tags=["audit"])


@router.get("", response_model=list[AuditLogOut])
def list_audit_logs(
    limit: int = 200,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(RoleEnum.ADMIN.value, RoleEnum.REVIEWER.value)),
):
    return (
        db.query(AuditLog)
        .order_by(AuditLog.created_at.desc())
        .limit(min(limit, 500))
        .all()
    )
