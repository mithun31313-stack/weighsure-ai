from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Text
from sqlalchemy.orm import relationship
from app.core.database import Base


class AppSetting(Base):
    """
    Runtime-configurable app settings, editable from the Settings UI.
    Values here take priority over the .env defaults — this lets an Admin
    change the LLM API key, org name, etc. without touching the server's
    environment file or restarting anything by hand.
    """
    __tablename__ = "app_settings"

    key = Column(String(100), primary_key=True)  # e.g. "LLM_PROVIDER_API_KEY", "ORG_NAME"
    value = Column(Text, nullable=True)
    updated_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)  # recipient
    title = Column(String(200), nullable=False)
    body = Column(String(500), nullable=True)
    link = Column(String(200), nullable=True)  # e.g. /tests/12
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")
