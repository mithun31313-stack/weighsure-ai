from pydantic import BaseModel, EmailStr
from typing import Optional


class AppConfigOut(BaseModel):
    LLM_PROVIDER_API_KEY: str  # masked
    LLM_PROVIDER_API_KEY_SET: bool
    ORG_NAME: str
    PUBLIC_VERIFY_BASE_URL: str


class AppConfigUpdate(BaseModel):
    LLM_PROVIDER_API_KEY: Optional[str] = None  # set to update; omit/blank to leave unchanged
    ORG_NAME: Optional[str] = None
    PUBLIC_VERIFY_BASE_URL: Optional[str] = None


class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


class UserOut(BaseModel):
    id: int
    full_name: str
    email: EmailStr
    role: str
    laboratory_id: Optional[int] = None
    is_active: bool

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
