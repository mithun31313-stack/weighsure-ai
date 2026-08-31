# WeighSure AI

**Smart Testing. Accurate Compliance. Trusted Reports.**

Digital laboratory platform for generating OIML R 76 (Non-Automatic Weighing
Instruments) compliance test reports. Built for Smart India Hackathon.

## Structure
```
/backend    FastAPI + SQLAlchemy — auth, rule engine, ComplianceEngine,
            AI Laboratory Assistant, PDF/QR reports, attachments
/frontend   React + TypeScript + Tailwind — full lab workflow UI + chatbot
/database   (schema lives in backend/app/models — SQLAlchemy is the source of truth)
/docs       (add architecture notes / SIH submission docs here)
```

## Quick start

**1. Backend**
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
python -m app.seed
uvicorn app.main:app --reload --port 8000
```

**2. Frontend** (separate terminal)
```bash
cd frontend
npm install
npm run dev
```

Visit `http://localhost:5173`. Demo credentials are in `backend/README.md`.

## Status: feature-complete MVP
Every section of the original spec is implemented and has been tested live
(not just written) — auth & roles, instrument registration, the versioned
DEMO rule engine, the deterministic ComplianceEngine (5 test modules), the
AI Laboratory Assistant (explain / anomaly detection / summary / NL search
/ conversational chatbot), PDF report generation with QR verification and
tamper-detection hashing, attachment upload, audit trail, and the full
React frontend including the eccentricity visual platform.

See `backend/README.md` and `frontend/README.md` for details on each phase.

## SIH Demo Flow
1. Log in as Test Engineer
2. Register or select the demo instrument (ABC-100)
3. Create a new test, select the DEMO OIML R 76 rule set
4. Submit a weighing performance observation → PASS
5. Submit a deliberately large-error observation → FAIL
6. Click "Explain Result" on the FAIL — AI explains without changing the verdict
7. Correct and retest → PASS
8. Try the floating AI Assistant: "how many instruments do we have"
9. Move the test through the review workflow (Engineer → Reviewer)
10. Reviewer finalizes → PDF report + QR code generated
11. Scan/open the QR link → public `/verify/:reportId` page confirms AUTHENTIC
12. Everything is traceable in the audit trail
