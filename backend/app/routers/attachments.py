from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.user import User, RoleEnum
from app.models.test import Test, TestStatus
from app.models.report import Attachment, AuditLog
from app.schemas.attachment import AttachmentOut
from app.services.attachment_service import validate_and_store

router = APIRouter(prefix="/api/tests", tags=["attachments"])


@router.post("/{test_id}/attachments", response_model=AttachmentOut)
async def upload_attachment(
    test_id: int,
    category: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(RoleEnum.TEST_ENGINEER.value, RoleEnum.ADMIN.value)),
):
    test = db.query(Test).filter(Test.id == test_id).first()
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    if test.status == TestStatus.FINALIZED:
        raise HTTPException(status_code=400, detail="Cannot add attachments to a finalized test")

    content = await file.read()
    stored_path, file_hash, size_bytes = validate_and_store(test_id, category, file, content)

    attachment = Attachment(
        test_id=test_id, category=category, filename=file.filename,
        stored_path=stored_path, file_hash=file_hash, file_size_bytes=size_bytes,
        uploaded_by_id=user.id,
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)

    db.add(AuditLog(actor_id=user.id, action="attachment.uploaded", entity_type="test", entity_id=test_id,
                     details={"category": category, "filename": file.filename}))
    db.commit()
    return attachment


@router.get("/{test_id}/attachments", response_model=list[AttachmentOut])
def list_attachments(test_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(Attachment).filter(Attachment.test_id == test_id).all()


@router.get("/{test_id}/attachments/{attachment_id}/download")
def download_attachment(test_id: int, attachment_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    attachment = db.query(Attachment).filter(Attachment.id == attachment_id, Attachment.test_id == test_id).first()
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")
    return FileResponse(attachment.stored_path, filename=attachment.filename)
