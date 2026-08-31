import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(BASE_DIR / ".env")

class Settings:
    APP_NAME: str = "WeighSure AI"
    ENV: str = os.getenv("ENV", "development")

    # DATABASE_URL: postgresql+psycopg2://user:pass@host:5432/dbname
    # Falls back to local SQLite so the project runs with zero external setup.
    # Uses `or` (not getenv's default arg) because DATABASE_URL= with nothing
    # after it still sets the variable to an empty string, which getenv's
    # default would never override — only a truly unset/missing var falls
    # through with getenv's default.
    DATABASE_URL: str = os.getenv("DATABASE_URL") or f"sqlite:///{(BASE_DIR / 'weighsure.db').as_posix()}"

    JWT_SECRET: str = os.getenv("JWT_SECRET", "dev-secret-change-me")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))

    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", str(BASE_DIR / "uploads"))
    MAX_UPLOAD_MB: int = int(os.getenv("MAX_UPLOAD_MB", "10"))

    PUBLIC_VERIFY_BASE_URL: str = os.getenv("PUBLIC_VERIFY_BASE_URL", "http://localhost:5173/verify")

    LLM_PROVIDER_API_KEY: str = os.getenv("LLM_PROVIDER_API_KEY", "")

settings = Settings()
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
