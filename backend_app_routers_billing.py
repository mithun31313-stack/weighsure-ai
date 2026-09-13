from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.user import User, RoleEnum
from app.models.report import AuditLog
from app.schemas.billing import (
    BillingStatusOut, CreateOrderRequest, CreateOrderResponse, VerifyPaymentRequest, RazorpayKeysUpdate,
)
from app.services import billing_service

router = APIRouter(prefix="/api/billing", tags=["billing"])


@router.get("/status", response_model=BillingStatusOut)
def billing_status(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if not user.laboratory_id:
        raise HTTPException(status_code=400, detail="User is not assigned to a laboratory")
    sub = billing_service.get_or_create_subscription(db, user.laboratory_id)
    key_id = billing_service.get_razorpay_key_id(db)
    return BillingStatusOut(
        plan=sub.plan, status=sub.status, expires_at=sub.expires_at,
        razorpay_key_id=key_id or None,
    )


@router.post("/create-order", response_model=CreateOrderResponse)
def create_order(
    payload: CreateOrderRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles(RoleEnum.ADMIN.value)),
):
    try:
        order = billing_service.create_order(db, payload.plan)
    except billing_service.BillingError as e:
        raise HTTPException(status_code=400, detail=str(e))

    db.add(AuditLog(actor_id=admin.id, action="billing.order_created",
                     details={"plan": payload.plan, "order_id": order["order_id"]}))
    db.commit()
    return order


@router.post("/verify", response_model=BillingStatusOut)
def verify_payment(
    payload: VerifyPaymentRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles(RoleEnum.ADMIN.value)),
):
    try:
        valid = billing_service.verify_payment_signature(
            db, payload.razorpay_order_id, payload.razorpay_payment_id, payload.razorpay_signature
        )
    except billing_service.BillingError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not valid:
        db.add(AuditLog(actor_id=admin.id, action="billing.verification_failed",
                         details={"order_id": payload.razorpay_order_id}))
        db.commit()
        raise HTTPException(status_code=400, detail="Payment signature verification failed")

    sub = billing_service.activate_subscription(
        db, admin.laboratory_id, payload.plan, payload.razorpay_order_id, payload.razorpay_payment_id
    )
    db.add(AuditLog(actor_id=admin.id, action="billing.subscription_activated",
                     details={"plan": payload.plan, "expires_at": str(sub.expires_at)}))
    db.commit()

    key_id = billing_service.get_razorpay_key_id(db)
    return BillingStatusOut(plan=sub.plan, status=sub.status, expires_at=sub.expires_at, razorpay_key_id=key_id or None)


@router.put("/razorpay-keys")
def set_razorpay_keys(
    payload: RazorpayKeysUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles(RoleEnum.ADMIN.value)),
):
    billing_service.set_razorpay_keys(db, payload.key_id, payload.key_secret, admin.id)
    db.add(AuditLog(actor_id=admin.id, action="billing.razorpay_keys_updated"))
    db.commit()
    return {"status": "ok", "razorpay_key_id_masked": billing_service.mask_secret(payload.key_id)}
