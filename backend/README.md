# WeighSure AI — Backend (Phase 1)

## What's built so far
- Full DB schema (17 tables) matching the spec: users, laboratories, instruments,
  instrument_history, standards, standard_versions, test_types, rules,
  rule_conditions, acceptance_criteria, tests, observations, test_results,
  reports, attachments, audit_logs, signatures, verification_records.
- JWT auth + bcrypt password hashing + role-based access (ADMIN / TEST_ENGINEER / REVIEWER).
- Rule engine tables with clearly-labelled **DEMO** rules (not official OIML values —
  see `source_reference` field on every rule).
- Seed script creating demo lab, 3 demo users, 5 demo rules (one per test type),
  and the ABC-100 demo instrument.
- Runs on SQLite by default (zero setup) or PostgreSQL via `DATABASE_URL`.

## Phase 2 — done
- Instrument CRUD router (`/api/instruments`) with change-history tracking.
- Test workflow router (`/api/tests`) implementing the full state machine:
  DRAFT → IN_PROGRESS → COMPLETED → UNDER_REVIEW → APPROVED/REJECTED → FINALIZED,
  with role checks per transition (engineer drives DRAFT→UNDER_REVIEW, reviewer
  drives APPROVED/REJECTED/FINALIZED, REJECTED loops back to IN_PROGRESS for retest).
- **ComplianceEngine** (`app/services/compliance_engine.py`) — the deterministic,
  rule-based PASS/FAIL authority. All 5 test modules implemented as pure
  calculator functions: weighing_performance, repeatability, eccentricity,
  zero, tare. Every result stores the exact rule_id it was judged against.
- `POST /api/tests/{id}/observations` records the observation AND runs it
  through the engine in the same call, returning calculated values +
  criterion + PASS/FAIL — traceable, auditable.

**Verified live** (see `/tmp` test — reproducible): created a test on the
seeded ABC-100 instrument, submitted a small-error observation → PASS,
a large-error observation → FAIL, and a tight-trial repeatability
observation → PASS, all evaluated against the seeded DEMO rules using the
instrument's actual `e` value. Workflow transition DRAFT→COMPLETED also
verified.

## Phase 3 — done: AI Laboratory Assistant (`/api/ai`)
All four features are **advisory only** — none can change a PASS/FAIL result,
which always comes from the ComplianceEngine.

- `POST /api/ai/explain/{test_result_id}` — plain-language explanation of an
  already-decided result. Works with zero setup via a deterministic template;
  if `LLM_PROVIDER_API_KEY` is set in `.env`, it calls a real LLM for more
  natural phrasing instead (same underlying facts either way).
- `POST /api/ai/anomaly-check` — fits an IsolationForest (scikit-learn) on an
  instrument's historical observations for a test type and flags whether a
  new value is a statistical outlier. Needs >=5 prior observations; returns a
  "not enough data" response otherwise. Never claims a specific physical
  fault — only flags a deviation and lists investigation points.
- `GET /api/ai/summary/{test_id}` — rollup of pass/fail counts and the actual
  failed observations for a test, built directly from stored results.
- `POST /api/ai/search` — keyword-routed natural language search over tests
  and reports (e.g. "show failed tests for ABC-100", "which instrument had
  the highest deviation", "show reports from this month"). Deterministic
  routing — it never invents data, only queries the DB.

**Verified live**: built a 5-observation PASS history on the demo instrument,
confirmed `explain` correctly describes both a PASS and a FAIL case with the
real numbers, confirmed anomaly-check passes a normal 0.003 reading and
flags an outlier 0.5 reading against that history, confirmed summary counts
(5 passed / 1 failed) and all three example NL search queries return correct
live data.

## Phase 4 — done: PDF Report Generation + QR Verification (`/api/reports`, `/api/verify`)
- `POST /api/tests/{test_id}/finalize` (reviewer/admin only, test must be APPROVED) —
  generates the full 22-section PDF report, a QR code linking to the public
  verification page, computes a SHA-256 tamper-detection hash over the
  report's core data, and moves the test to FINALIZED.
- `GET /api/reports` / `GET /api/reports/{report_id}` — list/fetch report metadata.
- `GET /api/reports/{report_id}/download` — serves the PDF.
- `GET /api/verify/{report_id}` — **public, no auth**. Returns only
  verification-safe fields (never raw observations, engineer identity, or
  internal IDs) plus a live `tamper_check: VALID/FAILED` computed by
  re-hashing current DB state against the stored hash.
- Demo/sample rule sets are visually flagged on the PDF itself with an
  orange "DEMO DATA NOTICE" banner — never silently presented as validated
  OIML values.

**Verified live end-to-end**: ran a test through the full workflow
(DRAFT → ... → APPROVED as reviewer), finalized it, downloaded the resulting
PDF (rendered and visually inspected — all sections present, PASS/FAIL rows
colour-coded, QR code renders and correctly points to the verify URL), and
hit the public `/api/verify/{report_id}` endpoint with no auth token —
returned `AUTHENTIC` / `tamper_check: VALID`.

## Phase 5 — done: Attachment Upload (`/api/tests/{id}/attachments`)
- `POST /api/tests/{test_id}/attachments` — multipart upload, category
  (`instrument_photo` / `nameplate` / `setup` / `load_placement` / `document`),
  validates file extension per category and size against `MAX_UPLOAD_MB`,
  computes a SHA-256 file hash, stores metadata in the `Attachment` table.
- `GET /api/tests/{test_id}/attachments` — list.
- `GET /api/tests/{test_id}/attachments/{id}/download` — download.
- Report generator updated: Section 16 now embeds the actual uploaded photos
  in the PDF (category label + filename + image), instead of just a count.
- Blocked once a test is FINALIZED.

**Verified live**: uploaded a real JPEG to a test, confirmed a bad category
is correctly rejected with 400, ran the test through to finalize, downloaded
the resulting PDF, and visually confirmed the photo renders inside Section 16.

## Backend status: feature-complete
All sections of the original spec are implemented and tested end-to-end:
auth, instruments, rule engine, ComplianceEngine (5 test modules), AI
assistant (4 features), PDF reports + QR verification + tamper hash, audit
trail, and attachment upload. Remaining work is the **frontend** (React/TS/Tailwind).

## Run it

```bash
cd backend
python -m venv venv && source venv/bin/activate   # optional but recommended
pip install -r requirements.txt
cp .env.example .env
python -m app.seed          # creates demo data (weighsure.db)
uvicorn app.main:app --reload --port 8000
```

Visit `http://localhost:8000/docs` for interactive API docs (Swagger).

## Demo credentials (from seed)
| Role | Email | Password |
|---|---|---|
| Admin | admin@weighsure.ai | Admin@123 |
| Test Engineer | engineer@weighsure.ai | Engineer@123 |
| Reviewer | reviewer@weighsure.ai | Reviewer@123 |

## Verified working
- `GET /api/health` → 200
- `POST /api/auth/login` → returns JWT + role ✅ tested end-to-end
- `GET /api/auth/me` (with Bearer token)
- `POST /api/auth/users` (admin-only, creates new users)

## Phase 6 — done: Settings, User Management, Notifications (`/api/settings`, `/api/notifications`)
- **DB-backed app config** (`app_settings` table) — the LLM API key, org name,
  and public verify URL can now be changed from the Settings UI and take
  effect **immediately, no restart, no .env editing**. DB value takes
  priority over `.env`; falls back to `.env` if nothing's been set in the UI.
  (This exists specifically because hand-editing `.env` files is fragile —
  the UI path avoids that entirely.)
- Full user management: Admin can list, create, change role, and
  activate/deactivate Engineer/Reviewer/Admin accounts from the UI (not just
  via the seed script).
- Self-service profile editing and password change for any logged-in user.
- In-app notifications: when a test moves to `UNDER_REVIEW`, every active
  Reviewer/Admin gets a notification; a bell icon (top-right, all pages)
  shows an unread badge and a dropdown linking straight to the test.
  Polls every 30s. (Email notifications were explicitly scoped out — no
  SMTP credentials available; in-app only.)

**Verified live**: saved an API key through Settings → confirmed masked
display + "takes effect immediately" — no server restart involved; created
a new user through the UI and confirmed it appeared in the table with working
role/status controls; moved a test to UNDER_REVIEW and confirmed the
reviewer's notification bell showed the correct badge count and message.

## Also fixed this phase (root cause, not a workaround)
`DATABASE_URL=` (present but empty) in `.env` was being read literally as an
empty string by `os.getenv(key, default)` — Python only falls back to the
default when the variable is completely *absent*, not when it's present-but-
empty. `config.py` now uses `os.getenv("DATABASE_URL") or <default>` instead,
which correctly falls through to local SQLite whenever the value is blank.
