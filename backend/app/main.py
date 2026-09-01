from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import Base, engine
from app import models  # noqa: F401 — registers all models on Base
from app.routers import auth as auth_router
from app.routers import instruments as instruments_router
from app.routers import tests as tests_router
from app.routers import ai as ai_router
from app.routers import reports as reports_router
from app.routers import attachments as attachments_router
from app.routers import standards as standards_router
from app.routers import settings as settings_router
from app.routers import notifications as notifications_router
from app.routers import audit as audit_router

app = FastAPI(title="WeighSure AI", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)

    # Auto-seed demo data if the database is empty. This exists specifically
    # because Render's free tier has no Shell/SSH access to run `python -m
    # app.seed` manually — so the app seeds itself once, safely, since
    # seed.run() only creates records that don't already exist (get_or_create).
    from app.core.database import SessionLocal
    from app.models.user import User

    db = SessionLocal()
    try:
        if db.query(User).count() == 0:
            from app.seed import run as seed_run
            seed_run()
    finally:
        db.close()


app.include_router(auth_router.router)
app.include_router(instruments_router.router)
app.include_router(tests_router.router)
app.include_router(ai_router.router)
app.include_router(reports_router.router)
app.include_router(attachments_router.router)
app.include_router(standards_router.router)
app.include_router(settings_router.router)
app.include_router(notifications_router.router)
app.include_router(audit_router.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "app": "WeighSure AI"}
