from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.user import User, RoleEnum
from app.models.instrument import Instrument, InstrumentHistory
from app.models.report import AuditLog
from app.schemas.instrument import (
    InstrumentCreate, InstrumentUpdate, InstrumentOut, InstrumentHistoryOut,
)

router = APIRouter(prefix="/api/instruments", tags=["instruments"])


def _next_instrument_code(db: Session) -> str:
    year = datetime.now(timezone.utc).year
    count = db.query(Instrument).count() + 1
    return f"INS-{year}-{count:04d}"


@router.post("", response_model=InstrumentOut)
def create_instrument(
    payload: InstrumentCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(RoleEnum.TEST_ENGINEER.value, RoleEnum.ADMIN.value)),
):
    if db.query(Instrument).filter(Instrument.serial_number == payload.serial_number).first():
        raise HTTPException(status_code=400, detail="Serial number already registered")
    if not user.laboratory_id:
        raise HTTPException(status_code=400, detail="User is not assigned to a laboratory")

    instrument = Instrument(
        instrument_code=_next_instrument_code(db),
        laboratory_id=user.laboratory_id,
        created_by_id=user.id,
        **payload.model_dump(),
    )
    db.add(instrument)
    db.commit()
    db.refresh(instrument)

    db.add(AuditLog(actor_id=user.id, action="instrument.created",
                     entity_type="instrument", entity_id=instrument.id))
    db.commit()
    return instrument


@router.get("", response_model=list[InstrumentOut])
def list_instruments(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(Instrument).filter(Instrument.laboratory_id == user.laboratory_id).all()


@router.get("/{instrument_id}", response_model=InstrumentOut)
def get_instrument(instrument_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    instrument = db.query(Instrument).filter(Instrument.id == instrument_id).first()
    if not instrument:
        raise HTTPException(status_code=404, detail="Instrument not found")
    return instrument


@router.put("/{instrument_id}", response_model=InstrumentOut)
def update_instrument(
    instrument_id: int, payload: InstrumentUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(RoleEnum.TEST_ENGINEER.value, RoleEnum.ADMIN.value)),
):
    instrument = db.query(Instrument).filter(Instrument.id == instrument_id).first()
    if not instrument:
        raise HTTPException(status_code=404, detail="Instrument not found")

    changes = payload.model_dump(exclude_unset=True)
    summary_parts = []
    for field, value in changes.items():
        old = getattr(instrument, field)
        if old != value:
            summary_parts.append(f"{field}: {old} -> {value}")
            setattr(instrument, field, value)

    db.commit()
    db.refresh(instrument)

    if summary_parts:
        db.add(InstrumentHistory(
            instrument_id=instrument.id, changed_by_id=user.id,
            change_summary="; ".join(summary_parts),
        ))
        db.add(AuditLog(actor_id=user.id, action="instrument.updated",
                         entity_type="instrument", entity_id=instrument.id,
                         details={"changes": summary_parts}))
        db.commit()

    return instrument


@router.get("/{instrument_id}/history", response_model=list[InstrumentHistoryOut])
def get_instrument_history(instrument_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return (
        db.query(InstrumentHistory)
        .filter(InstrumentHistory.instrument_id == instrument_id)
        .order_by(InstrumentHistory.changed_at.desc())
        .all()
    )
