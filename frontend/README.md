# WeighSure AI — Frontend

React + TypeScript + Tailwind CSS (v4) + Recharts + React Router.

## Design
- **Palette**: deep marine ink, slate steel, brass/calibration-weight amber —
  grounded in engineering/metrology rather than generic SaaS defaults.
- **Type**: Space Grotesk (display), Inter (body), IBM Plex Mono (measurements,
  rule codes, report IDs).
- **Signature motif**: a graduated "verification scale" tick ruler, directly
  referencing `e` — the verification scale interval central to OIML R 76 —
  used on the login hero and as a sidebar divider.

## Run it

```bash
npm install
npm run dev
```

The dev server proxies `/api` to `http://localhost:8000` (see `vite.config.ts`),
so start the backend first (see `../backend/README.md`).

Visit `http://localhost:5173`. Log in with any of the seeded demo accounts
(see backend README).

## What's built
- Login (JWT auth, role-aware)
- Dashboard — live stat cards, tests-by-month bar chart, instrument-class pie
  chart, recent tests table — all from real API calls, no mock data
- Instruments — list + registration form
- Tests — list, creation, and the core **Test Detail** workspace:
  - Tabbed observation entry for all 5 test modules, including a visual
    A/B/C/D/Center eccentricity platform
  - Live PASS/FAIL results from the backend ComplianceEngine
  - "Explain Result" (AI) and "Check Anomaly" (AI) inline actions
  - Workflow buttons that respect role + current status
  - Attachment upload
  - Report download once finalized
- Reports list
- Public `/verify/:reportId` page — no login required, shows tamper-check status
- **Floating AI Laboratory Assistant chatbot** — available on every
  authenticated page, answers questions about live lab data (instrument
  counts, failed tests, pending reviews, test status lookups, highest
  deviation) via deterministic DB queries, with an LLM fallback for
  open-ended questions if `LLM_PROVIDER_API_KEY` is set in the backend.

## Verified working
Ran the full stack live (backend + frontend + a headless browser) and
confirmed by screenshot: login, dashboard with real seeded data, instrument
list, test creation, weighing-performance observation → PASS result, the
eccentricity visual platform, AI "Explain Result", and a live chatbot
conversation that correctly queried the database.

## Multi-language: English, Hindi, Tamil
- Full UI translated across every page (nav, forms, tables, buttons,
  Settings, the login hero) — a language switcher sits in the sidebar
  (also on Login and the public Verify page). Persists to `localStorage`.
- Fonts: Noto Sans Devanagari and Noto Sans Tamil loaded alongside the
  Latin fonts so both scripts render correctly, not as tofu boxes.
- The AI chatbot and "Explain Result" respond in the selected language:
  - With an LLM key configured, the model is instructed to reply in the
    chosen language; structured lab-data answers are translated by the
    LLM while the underlying facts/numbers are held fixed (the DB query
    result is what's translated, not regenerated).
  - Without an LLM key, the deterministic fallback text (help message,
    PASS/FAIL explanation templates) is still fully localized in Hindi
    and Tamil — only structured data lookups requiring translation of
    dynamic facts stay in English until an LLM key is added, since
    translating exact numbers without a model risks corrupting them.
- Real, permanent app data (instrument names, serial numbers, user names,
  test codes) is never translated — only UI chrome and AI-generated text.

**Verified live**: switched to Hindi on the login page (hero copy, form
labels) and to Tamil across Dashboard/Instruments/Settings — Devanagari and
Tamil scripts render correctly. Confirmed via direct API calls that
`/api/ai/explain` returns correctly localized PASS and FAIL explanations in
both languages (with real calculated values embedded), and `/api/ai/chat`
returns a fully Tamil-localized fallback help message for unrecognized
queries.

## Advanced features: Quick Actions, AI Insight, Analytics, Calibrations, Audit Trail, Live Instrument
- **Dashboard**: Quick Start action cards, an "AI Insight" card (deterministic
  lab-wide rollup — no LLM key required, always available), and a Live
  Instrument panel.
- **Analytics page**: pass/fail trend over time and a results-by-test-type
  breakdown, both built from real `TestResult` data (test type is now
  exposed by the API specifically to make this chart honest, not a stub).
- **Calibrations page**: next-due date per instrument, computed from the
  last recorded test date. The 365-day interval is explicitly labeled as a
  planning-aid assumption, not an OIML R 76 requirement — real calibration
  intervals are set by regulation/lab policy.
- **Audit Trail page**: full visibility (Admin/Reviewer) into the same
  tamper-evident log that's already embedded in generated PDF reports —
  logins, test creation, status transitions, report generation, all in
  order.
- **Live Instrument**: a real Web Serial API integration (Chrome/Edge,
  HTTPS or localhost) that connects to an actual USB/serial digital scale
  and parses live weight readings from the incoming stream. This talks to
  genuine hardware — I have no physical scale to test it against, so
  verify it against yours; the output-format parser (first floating-point
  number per line) covers many simple ASCII scale protocols but may need
  adjusting for instruments with a different output format.

**Verified live**: ran a full test sequence (3 tests, mixed pass/fail,
one taken through to FINALIZED) and confirmed by screenshot — the AI
Insight card correctly summarized "1 of the last 20 observations failed,"
the Analytics page's by-test-type chart matched the exact pass/fail counts
created, the Calibrations page computed the correct due date, and the Audit
Trail showed every single action from that sequence in the right order.

## Offline support (PWA app-shell + cached data)
- A service worker (`public/sw.js`) caches the app shell and every
  successful `GET /api/*` response as they're loaded, so the app boots and
  shows last-seen data with the network fully cut.
- An offline banner appears app-wide when the connection drops.
- Installable as a PWA (`manifest.json` + icons) on desktop/mobile Chrome.
- **Explicit scope boundary**: this does NOT queue writes made while
  offline for later sync — creating a test, submitting an observation, or
  any other mutation still requires a live connection and will fail
  visibly if attempted offline. Building a reliable offline write queue
  with conflict resolution is a separate, substantially larger feature
  that wasn't attempted here rather than half-built and shipped as if it
  were solid.

**Verified live**: logged in normally (letting the service worker cache the
shell + API responses), confirmed the SW reached `activated` state, then
used a real browser-level network cut (not just closing wifi — an actual
Playwright `context.set_offline(true)`) and reloaded — the Dashboard
rendered fully from cache with the offline banner showing. Navigated to
Instruments while still offline and the real ABC-100 instrument data loaded
correctly from the cached API response, not a blank screen.
