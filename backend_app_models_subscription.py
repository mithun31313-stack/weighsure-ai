from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class Subscription(Base):
    """
    One row per laboratory (company). Tracks their plan and whether it's
    currently paid-and-active. Created lazily (get_or_create pattern) the
    first time a lab's billing status is checked, defaulting to TRIAL.
    """
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True)
    laboratory_id = Column(Integer, ForeignKey("laboratories.id"), unique=True, nullable=False)

    plan = Column(String(20), default="TRIAL")  # TRIAL | MONTHLY | ANNUAL
    status = Column(String(20), default="TRIAL")  # TRIAL | ACTIVE | EXPIRED

    razorpay_customer_id = Column(String(100), nullable=True)
    last_order_id = Column(String(100), nullable=True)
    last_payment_id = Column(String(100), nullable=True)

    expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    laboratory = relationship("Laboratory")
