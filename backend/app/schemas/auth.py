from pydantic import BaseModel, EmailStr
from typing import Optional


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    full_name: str
    user_id: int


class UserCreateRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    role: str  # ADMIN | TEST_ENGINEER | REVIEWER
    laboratory_id: Optional[int] = None


class UserOut(BaseModel):
    id: int
    full_name: str
    email: EmailStr
    role: str
    laboratory_id: Optional[int] = None
    is_active: bool

    class Config:
        from_attributes = True
