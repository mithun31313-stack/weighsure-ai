from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_roles, hash_password, verify_password
from app.models.user import User, RoleEnum
from app.models.report import AuditLog
from app.schemas.settings import (
    AppConfigOut, AppConfigUpdate, ProfileUpdate, PasswordChange, UserOut, UserUpdate,
)
from app.schemas.auth import UserCreateRequest
from app.services import app_settings as settings_service

router = APIRouter(prefix="/api/settings", tags=["settings"])


# ---- App config (Admin only) ----

@router.get("/app-config", response_model=AppConfigOut)
def get_app_config(db: Session = Depends(get_db), admin: User = Depends(require_roles(RoleEnum.ADMIN.value))):
    key = settings_service.get_effective(db, "LLM_PROVIDER_API_KEY")
    return AppConfigOut(
        LLM_PROVIDER_API_KEY=settings_service.mask("LLM_PROVIDER_API_KEY", key),
        LLM_PROVIDER_API_KEY_SET=bool(key),
        ORG_NAME=settings_service.get_effective(db, "ORG_NAME"),
        PUBLIC_VERIFY_BASE_URL=settings_service.get_effective(db, "PUBLIC_VERIFY_BASE_URL"),
    )


@router.put("/app-config", response_model=AppConfigOut)
def update_app_config(
    payload: AppConfigUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles(RoleEnum.ADMIN.value)),
):
    if payload.LLM_PROVIDER_API_KEY:
        settings_service.set_value(db, "LLM_PROVIDER_API_KEY", payload.LLM_PROVIDER_API_KEY, admin.id)
    if payload.ORG_NAME:
        settings_service.set_value(db, "ORG_NAME", payload.ORG_NAME, admin.id)
    if payload.PUBLIC_VERIFY_BASE_URL:
        settings_service.set_value(db, "PUBLIC_VERIFY_BASE_URL", payload.PUBLIC_VERIFY_BASE_URL, admin.id)

    db.add(AuditLog(actor_id=admin.id, action="settings.app_config.updated", entity_type="app_settings"))
    db.commit()
    return get_app_config(db, admin)


# ---- Profile (self-service) ----

@router.put("/profile", response_model=UserOut)
def update_profile(payload: ProfileUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if payload.full_name:
        user.full_name = payload.full_name
    db.commit()
    db.refresh(user)
    return user


@router.post("/change-password")
def change_password(payload: PasswordChange, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if not verify_password(payload.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(payload.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")
    user.hashed_password = hash_password(payload.new_password)
    db.commit()
    db.add(AuditLog(actor_id=user.id, action="user.password_changed", entity_type="user", entity_id=user.id))
    db.commit()
    return {"status": "ok"}


# ---- User management (Admin only) ----

@router.get("/users", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db), admin: User = Depends(require_roles(RoleEnum.ADMIN.value))):
    return db.query(User).order_by(User.id).all()


@router.post("/users", response_model=UserOut)
def create_user(
    payload: UserCreateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles(RoleEnum.ADMIN.value)),
):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    if payload.role not in [r.value for r in RoleEnum]:
        raise HTTPException(status_code=400, detail="Invalid role")

    user = User(
        full_name=payload.full_name,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role=payload.role,
        laboratory_id=payload.laboratory_id or admin.laboratory_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    db.add(AuditLog(actor_id=admin.id, action="user.created", entity_type="user", entity_id=user.id))
    db.commit()
    return user


@router.put("/users/{user_id}", response_model=UserOut)
def update_user(
    user_id: int, payload: UserUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles(RoleEnum.ADMIN.value)),
):
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.full_name is not None:
        target.full_name = payload.full_name
    if payload.role is not None:
        if payload.role not in [r.value for r in RoleEnum]:
            raise HTTPException(status_code=400, detail="Invalid role")
        target.role = payload.role
    if payload.is_active is not None:
        target.is_active = payload.is_active

    db.commit()
    db.refresh(target)
    db.add(AuditLog(actor_id=admin.id, action="user.updated", entity_type="user", entity_id=target.id))
    db.commit()
    return target
