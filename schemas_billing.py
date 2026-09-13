from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class BillingStatusOut(BaseModel):
    plan: str  # "TRIAL" | "MONTHLY" | "ANNUAL"
    status: str  # "ACTIVE" | "EXPIRED" | "TRIAL"
    expires_at: Optional[datetime] = None
    razorpay_key_id: Optional[str] = None  # public key, safe to send to frontend for checkout widget


class CreateOrderRequest(BaseModel):
    plan: str  # "MONTHLY" | "ANNUAL"


class CreateOrderResponse(BaseModel):
    order_id: str
    amount: int  # in paise
    currency: str = "INR"
    razorpay_key_id: str
    plan: str


class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    plan: str


class RazorpayKeysUpdate(BaseModel):
    key_id: str
    key_secret: str
