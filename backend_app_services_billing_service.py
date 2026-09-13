"""
Billing service: Razorpay order creation + payment verification.

Design choices, deliberately kept self-contained (no edits to existing
settings files):
- Razorpay keys are stored in the same `app_settings` table the AI key
  uses, but read/written directly here rather than through the shared
  app_settings.py helper — this avoids touching that file's MANAGED_KEYS
  list, which is already live in production.
- No `razorpay` pip package needed: order creation is a single authenticated
  HTTP POST (Basic Auth with key_id:key_secret), and payment verification is
  a standard HMAC-SHA256 signature check — both documented, stable parts of
  Razorpay's API that don't need an SDK.
- Prices are defined here as the single source of truth so the frontend
  never decides the amount charged — it only tells the backend which plan
  the user picked, and the backend looks up the real price.
"""
import base64
import hashlib
import hmac
import json
import urllib.request
import urllib.error
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.settings import AppSetting
from app.models.subscription import Subscription

RAZORPAY_ORDERS_URL = "https://api.razorpay.com/v1/orders"

# Prices are the source of truth — in paise (INR smallest unit).
PLAN_PRICES = {
    "MONTHLY": {"amount": 99900, "label": "Monthly", "days": 30},
    "ANNUAL": {"amount": 599900, "label": "Annual", "days": 365},
}


class BillingError(Exception):
    pass


def _get_razorpay_key(db: Session, key: str) -> str:
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    return row.value if row and row.value else ""


def get_razorpay_key_id(db: Session) -> str:
    return _get_razorpay_key(db, "RAZORPAY_KEY_ID")


def get_razorpay_key_secret(db: Session) -> str:
    return _get_razorpay_key(db, "RAZORPAY_KEY_SECRET")


def set_razorpay_keys(db: Session, key_id: str, key_secret: str, user_id: int) -> None:
    for key, value in [("RAZORPAY_KEY_ID", key_id), ("RAZORPAY_KEY_SECRET", key_secret)]:
        if not value:
            continue
        row = db.query(AppSetting).filter(AppSetting.key == key).first()
        if row is None:
            db.add(AppSetting(key=key, value=value, updated_by_id=user_id))
        else:
            row.value = value
            row.updated_by_id = user_id
    db.commit()


def mask_secret(value: str) -> str:
    if not value:
        return ""
    if len(value) <= 8:
        return "*" * len(value)
    return f"{value[:6]}...{value[-4:]}"


def create_order(db: Session, plan: str) -> dict:
    if plan not in PLAN_PRICES:
        raise BillingError(f"Unknown plan '{plan}'")

    key_id = get_razorpay_key_id(db)
    key_secret = get_razorpay_key_secret(db)
    if not key_id or not key_secret:
        raise BillingError(
            "Razorpay is not configured yet. An Admin must add the Razorpay Key ID "
            "and Key Secret in Settings before subscriptions can be purchased."
        )

    amount = PLAN_PRICES[plan]["amount"]
    body = json.dumps({
        "amount": amount,
        "currency": "INR",
        "receipt": f"weighsure-{plan.lower()}-{int(datetime.now(timezone.utc).timestamp())}",
        "notes": {"plan": plan},
    }).encode("utf-8")

    auth = base64.b64encode(f"{key_id}:{key_secret}".encode()).decode()
    req = urllib.request.Request(
        RAZORPAY_ORDERS_URL,
        data=body,
        headers={"Content-Type": "application/json", "Authorization": f"Basic {auth}"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")
        raise BillingError(f"Razorpay order creation failed: {detail}")
    except urllib.error.URLError as e:
        raise BillingError(f"Could not reach Razorpay: {e}")

    return {
        "order_id": data["id"],
        "amount": amount,
        "currency": "INR",
        "razorpay_key_id": key_id,
        "plan": plan,
    }


def verify_payment_signature(db: Session, order_id: str, payment_id: str, signature: str) -> bool:
    """
    Razorpay's documented verification: HMAC-SHA256 of "order_id|payment_id",
    keyed with your Key Secret, must match the signature Razorpay sends back
    after a successful checkout. This is what proves the payment is real and
    wasn't spoofed by a request straight to our own API.
    """
    key_secret = get_razorpay_key_secret(db)
    if not key_secret:
        raise BillingError("Razorpay is not configured.")

    payload = f"{order_id}|{payment_id}".encode()
    expected = hmac.new(key_secret.encode(), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


def get_or_create_subscription(db: Session, laboratory_id: int) -> Subscription:
    sub = db.query(Subscription).filter(Subscription.laboratory_id == laboratory_id).first()
    if sub is None:
        sub = Subscription(laboratory_id=laboratory_id, plan="TRIAL", status="TRIAL")
        db.add(sub)
        db.commit()
        db.refresh(sub)
    # Auto-expire if past due
    if sub.status == "ACTIVE" and sub.expires_at and sub.expires_at < datetime.now(timezone.utc).replace(tzinfo=None):
        sub.status = "EXPIRED"
        db.commit()
    return sub


def activate_subscription(db: Session, laboratory_id: int, plan: str, order_id: str, payment_id: str) -> Subscription:
    if plan not in PLAN_PRICES:
        raise BillingError(f"Unknown plan '{plan}'")
    sub = get_or_create_subscription(db, laboratory_id)
    days = PLAN_PRICES[plan]["days"]
    sub.plan = plan
    sub.status = "ACTIVE"
    sub.last_order_id = order_id
    sub.last_payment_id = payment_id
    sub.expires_at = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=days)
    db.commit()
    db.refresh(sub)
    return sub
