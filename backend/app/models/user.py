import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class RoleEnum(str, enum.Enum):
    ADMIN = "ADMIN"
    TEST_ENGINEER = "TEST_ENGINEER"
    REVIEWER = "REVIEWER"


class Laboratory(Base):
    __tablename__ = "laboratories"

    id = Column(Integer, primary_key=True)
    name = Column(String(200), nullable=False)
    accreditation_no = Column(String(100), nullable=True)
    address = Column(String(300), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    users = relationship("User", back_populates="laboratory")
    instruments = relationship("Instrument", back_populates="laboratory")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    full_name = Column(String(150), nullable=False)
    email = Column(String(150), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(RoleEnum), nullable=False, default=RoleEnum.TEST_ENGINEER)
    laboratory_id = Column(Integer, ForeignKey("laboratories.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    laboratory = relationship("Laboratory", back_populates="users")
