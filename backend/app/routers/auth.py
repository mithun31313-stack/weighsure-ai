from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import (
    hash_password, verify_password, create_access_token,
    get_current_user, require_roles,
)
from app.models.user import User, RoleEnum
from app.models.report import AuditLog
from app.schemas.auth import LoginRequest, TokenResponse, UserCreateRequest, UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")

    token = create_access_token({"sub": str(user.id), "role": user.role.value})

    db.add(AuditLog(actor_id=user.id, action="auth.login", entity_type="user", entity_id=user.id))
    db.commit()

    return TokenResponse(
        access_token=token, role=user.role.value, full_name=user.full_name, user_id=user.id
    )


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user


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
        laboratory_id=payload.laboratory_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    db.add(AuditLog(actor_id=admin.id, action="user.created", entity_type="user", entity_id=user.id))
    db.commit()

    return user
