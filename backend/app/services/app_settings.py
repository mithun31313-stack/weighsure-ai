"""
Effective settings resolution: DB (app_settings table, editable via UI)
takes priority over .env / process environment defaults.

This exists so an Admin can change sensitive/operational config — the LLM
API key, org display name, public verify URL — from the Settings page,
without editing files on the server or restarting the process by hand.
"""
from sqlalchemy.orm import Session

from app.core.config import settings as env_settings
from app.models.settings import AppSetting

# Keys manageable from the Settings UI, with their .env fallback.
MANAGED_KEYS = {
    "LLM_PROVIDER_API_KEY": lambda: env_settings.LLM_PROVIDER_API_KEY,
    "ORG_NAME": lambda: "WeighSure AI Demo Laboratory",
    "PUBLIC_VERIFY_BASE_URL": lambda: env_settings.PUBLIC_VERIFY_BASE_URL,
}

# Keys whose values should never be echoed back in full over the API.
SECRET_KEYS = {"LLM_PROVIDER_API_KEY"}


def get_effective(db: Session, key: str) -> str:
    if key not in MANAGED_KEYS:
        raise ValueError(f"Unmanaged setting key: {key}")
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    if row is not None and row.value:
        return row.value
    return MANAGED_KEYS[key]()


def set_value(db: Session, key: str, value: str, user_id: int) -> None:
    if key not in MANAGED_KEYS:
        raise ValueError(f"Unmanaged setting key: {key}")
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    if row is None:
        row = AppSetting(key=key, value=value, updated_by_id=user_id)
        db.add(row)
    else:
        row.value = value
        row.updated_by_id = user_id
    db.commit()


def mask(key: str, value: str) -> str:
    if key not in SECRET_KEYS or not value:
        return value
    if len(value) <= 8:
        return "•" * len(value)
    return f"{value[:6]}…{value[-4:]}"
