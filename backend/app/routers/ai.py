from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.test import TestResult
from app.schemas.ai import AnomalyCheckRequest, SearchRequest, ChatRequest
from app.services import ai_assistant

router = APIRouter(prefix="/api/ai", tags=["ai-assistant"])


@router.post("/explain/{test_result_id}")
def explain_result(test_result_id: int, lang: str = "en", db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    result = db.query(TestResult).filter(TestResult.id == test_result_id).first()
    if not result:
        raise HTTPException(status_code=404, detail="Test result not found")
    return {
        "test_result_id": result.id,
        "result": result.result,  # authoritative, from ComplianceEngine — AI does not change this
        "explanation": ai_assistant.explain_result(result, db=db, lang=lang),
    }


@router.post("/anomaly-check")
def anomaly_check(payload: AnomalyCheckRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return ai_assistant.detect_anomaly(
        db, payload.instrument_id, payload.test_type_code, payload.new_value, payload.value_field
    )


@router.get("/summary/{test_id}")
def test_summary(test_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return ai_assistant.summarize_test(db, test_id)


@router.get("/lab-insight")
def lab_insight(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return ai_assistant.lab_insight(db)


@router.post("/search")
def search(payload: SearchRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return ai_assistant.natural_language_search(db, payload.query)


@router.post("/chat")
def chat(payload: ChatRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return ai_assistant.chat_response(db, payload.message, lang=payload.lang)
