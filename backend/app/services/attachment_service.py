import hashlib
import os
import uuid

from fastapi import UploadFile, HTTPException

from app.core.config import settings

ALLOWED_CATEGORIES = {"instrument_photo", "nameplate", "setup", "load_placement", "document"}
ALLOWED_EXTENSIONS = {
    "instrument_photo": {".jpg", ".jpeg", ".png", ".webp"},
    "nameplate": {".jpg", ".jpeg", ".png", ".webp"},
    "setup": {".jpg", ".jpeg", ".png", ".webp"},
    "load_placement": {".jpg", ".jpeg", ".png", ".webp"},
    "document": {".jpg", ".jpeg", ".png", ".webp", ".pdf"},
}

ATTACHMENTS_DIR = os.path.join(settings.UPLOAD_DIR, "attachments")
os.makedirs(ATTACHMENTS_DIR, exist_ok=True)


def validate_and_store(test_id: int, category: str, file: UploadFile, content: bytes) -> tuple[str, str, int]:
    """Validates category/type/size, writes the file to disk, returns (stored_path, file_hash, size_bytes)."""
    if category not in ALLOWED_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category. Must be one of {sorted(ALLOWED_CATEGORIES)}")

    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS[category]:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{ext}' not allowed for category '{category}'. Allowed: {sorted(ALLOWED_EXTENSIONS[category])}",
        )

    size_bytes = len(content)
    max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
    if size_bytes > max_bytes:
        raise HTTPException(status_code=400, detail=f"File exceeds max upload size of {settings.MAX_UPLOAD_MB} MB")
    if size_bytes == 0:
        raise HTTPException(status_code=400, detail="Empty file")

    file_hash = hashlib.sha256(content).hexdigest()

    test_dir = os.path.join(ATTACHMENTS_DIR, str(test_id))
    os.makedirs(test_dir, exist_ok=True)
    safe_name = f"{uuid.uuid4().hex}{ext}"
    stored_path = os.path.join(test_dir, safe_name)
    with open(stored_path, "wb") as f:
        f.write(content)

    return stored_path, file_hash, size_bytes
