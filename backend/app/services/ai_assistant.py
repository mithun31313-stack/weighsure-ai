"""
AI Laboratory Assistant
========================
Four features, all advisory-only:
  1. explain_result   — plain-language explanation of a PASS/FAIL that already
                         happened (facts come from TestResult, engine already decided)
  2. detect_anomaly    — statistical outlier flag on a new measurement vs history
                         (IsolationForest) — a STATISTICAL signal, not a compliance
                         decision and not a claim of physical fault
  3. summarize_test    — short rollup of a test's results
  4. natural_language_search — keyword-routed query over tests/reports

None of these functions may write to TestResult.result or otherwise influence
compliance. They only read what the ComplianceEngine already decided.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

import numpy as np
from sklearn.ensemble import IsolationForest
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.test import Test, Observation, TestResult, TestStatus
from app.models.instrument import Instrument
from app.models.rules import TestType
from app.services.llm_client import generate, LLMUnavailable


# ---------------------------------------------------------------------------
# 1. Explain Failure / Explain Result
# ---------------------------------------------------------------------------

TEMPLATE_STRINGS = {
    "en": {
        "pass": "This observation met the acceptance criterion ({criterion}). No further action is required for this measurement.",
        "fail": (
            "The recorded measurement did not meet the configured acceptance criterion ({criterion}). "
            "Observed values — {detail}. Please review the measurement, load placement, and test setup "
            "before retesting. Suggested checks: Recheck load placement and ensure the platform is level "
            "and stable. Confirm the reference mass/standard used is correctly calibrated and traceable. "
            "Verify environmental conditions (vibration, air currents, temperature drift) at time of test. "
            "Re-verify the instrument's zero setting before retesting."
        ),
    },
    "hi": {
        "pass": "यह अवलोकन स्वीकृति मानदंड ({criterion}) को पूरा करता है। इस माप के लिए किसी और कार्रवाई की आवश्यकता नहीं है।",
        "fail": (
            "दर्ज किया गया माप कॉन्फ़िगर किए गए स्वीकृति मानदंड ({criterion}) को पूरा नहीं करता। "
            "देखे गए मान — {detail}। कृपया पुनः परीक्षण से पहले माप, लोड प्लेसमेंट और परीक्षण सेटअप की समीक्षा करें। "
            "सुझाए गए जांच: लोड प्लेसमेंट की दोबारा जांच करें और सुनिश्चित करें कि प्लेटफ़ॉर्म समतल और स्थिर है। "
            "उपयोग किए गए संदर्भ द्रव्यमान/मानक का सही अंशांकन सुनिश्चित करें। परीक्षण के समय पर्यावरणीय स्थितियों "
            "(कंपन, हवा का प्रवाह, तापमान परिवर्तन) की पुष्टि करें। पुनः परीक्षण से पहले उपकरण की शून्य सेटिंग की पुनः पुष्टि करें।"
        ),
    },
    "ta": {
        "pass": "இந்த அவதானிப்பு ஏற்புத் தரத்தை ({criterion}) பூர்த்தி செய்தது. இந்த அளவீட்டுக்கு மேலும் நடவடிக்கை தேவையில்லை.",
        "fail": (
            "பதிவு செய்யப்பட்ட அளவீடு கட்டமைக்கப்பட்ட ஏற்புத் தரத்தை ({criterion}) பூர்த்தி செய்யவில்லை. "
            "கவனிக்கப்பட்ட மதிப்புகள் — {detail}. மீண்டும் சோதிக்கும் முன் அளவீடு, சுமை வைப்பு மற்றும் சோதனை "
            "அமைப்பை மறுபரிசீலனை செய்யவும். பரிந்துரைக்கப்படும் சரிபார்ப்புகள்: சுமை வைப்பை மீண்டும் சரிபார்த்து "
            "தளம் சமமாகவும் நிலையாகவும் இருப்பதை உறுதிசெய்யவும். பயன்படுத்தப்பட்ட குறிப்பு நிறை/தரநிலை சரியாக "
            "அளவீடு செய்யப்பட்டு கண்காணிக்கக்கூடியதா என்பதை உறுதிப்படுத்தவும். சோதனையின் போது சுற்றுச்சூழல் "
            "நிலைமைகளை (அதிர்வு, காற்று ஓட்டம், வெப்பநிலை மாற்றம்) சரிபார்க்கவும். மீண்டும் சோதிக்கும் முன் "
            "கருவியின் பூஜ்ஜிய அமைப்பை மீண்டும் சரிபார்க்கவும்."
        ),
    },
}


def _template_explanation(test_result: TestResult, lang: str = "en") -> str:
    cv = test_result.calculated_values
    strings = TEMPLATE_STRINGS.get(lang, TEMPLATE_STRINGS["en"])
    if test_result.result == "PASS":
        return strings["pass"].format(criterion=test_result.criterion_display)

    detail = ", ".join(f"{k}: {v}" for k, v in cv.items() if k not in ("unit", "positions"))
    return strings["fail"].format(criterion=test_result.criterion_display, detail=detail)


def explain_result(test_result: TestResult, db: Session = None, lang: str = "en") -> str:
    cv = test_result.calculated_values
    lang_names = {"en": "English", "hi": "Hindi (हिन्दी)", "ta": "Tamil (தமிழ்)"}
    system_prompt = (
        "You are a laboratory assistant explaining a weighing-instrument compliance test result. "
        "The PASS/FAIL decision has ALREADY been made by a deterministic rule engine — you must not "
        "change it or imply a different outcome. Explain the result plainly for a lab engineer in "
        "2-4 sentences, referencing the actual numbers given. If FAIL, suggest concrete, non-speculative "
        "checks (load placement, calibration, environment, zero setting) without asserting a specific "
        "physical fault as certain."
    )
    if lang != "en":
        system_prompt += f" Respond entirely in {lang_names.get(lang, lang)}."
    user_prompt = (
        f"Result: {test_result.result}\n"
        f"Criterion: {test_result.criterion_display}\n"
        f"Calculated values: {cv}\n"
    )
    try:
        return generate(system_prompt, user_prompt, db=db)
    except LLMUnavailable:
        return _template_explanation(test_result, lang=lang)


# ---------------------------------------------------------------------------
# 2. Anomaly Detection
# ---------------------------------------------------------------------------

def detect_anomaly(db: Session, instrument_id: int, test_type_code: str, new_value: float,
                    value_field: str = "error") -> dict:
    """
    Fits an IsolationForest on historical values (same instrument + test type)
    and scores whether `new_value` looks like an outlier. Purely statistical —
    does not claim a fault, does not affect PASS/FAIL.
    """
    test_type = db.query(TestType).filter(TestType.code == test_type_code).first()
    if not test_type:
        return {"anomaly": False, "reason": "Unknown test type", "history_count": 0}

    rows = (
        db.query(Observation)
        .join(Test, Observation.test_id == Test.id)
        .filter(Test.instrument_id == instrument_id, Observation.test_type_id == test_type.id)
        .all()
    )

    history = []
    for obs in rows:
        payload = obs.payload or {}
        if value_field == "error" and "reference_mass" in payload and "indicated_value" in payload:
            history.append(float(payload["indicated_value"]) - float(payload["reference_mass"]))
        elif value_field in payload:
            history.append(float(payload[value_field]))

    if len(history) < 5:
        return {
            "anomaly": False,
            "reason": "Not enough historical data yet for statistical anomaly detection (need >=5 prior observations).",
            "history_count": len(history),
        }

    X = np.array(history).reshape(-1, 1)
    model = IsolationForest(contamination=0.15, random_state=42)
    model.fit(X)
    prediction = model.predict([[new_value]])[0]  # -1 = anomaly, 1 = normal
    score = float(model.decision_function([[new_value]])[0])
    is_anomaly = prediction == -1

    result = {
        "anomaly": bool(is_anomaly),
        "anomaly_score": round(score, 4),
        "history_count": len(history),
        "history_mean": round(float(np.mean(X)), 5),
        "history_std": round(float(np.std(X)), 5),
        "new_value": new_value,
    }
    if is_anomaly:
        result["message"] = "⚠️ Potential anomaly detected — this measurement deviates unusually from prior readings on this instrument."
        result["investigation_points"] = [
            "Re-check the measurement was recorded correctly (units, decimal placement).",
            "Confirm the reference standard used matches prior tests.",
            "Inspect the instrument for visible damage or contamination since the last test.",
            "Consider a repeat measurement to confirm before drawing conclusions.",
        ]
    else:
        result["message"] = "No statistical anomaly detected relative to this instrument's history."
    return result


# ---------------------------------------------------------------------------
# 3. AI Test Summary
# ---------------------------------------------------------------------------

def summarize_test(db: Session, test_id: int) -> dict:
    test = db.query(Test).filter(Test.id == test_id).first()
    if not test:
        return {"error": "Test not found"}

    results = db.query(TestResult).filter(TestResult.test_id == test_id).all()
    passed = [r for r in results if r.result == "PASS"]
    failed = [r for r in results if r.result == "FAIL"]

    major_deviations = [
        {"result_id": r.id, "criterion": r.criterion_display, "values": r.calculated_values}
        for r in failed
    ]

    text = (
        f"Test {test.test_code}: {len(results)} observation(s) evaluated, "
        f"{len(passed)} passed, {len(failed)} failed. "
    )
    if failed:
        text += f"{len(failed)} item(s) require review before this test can be finalized."
    else:
        text += "No failures recorded — ready to proceed toward reviewer sign-off." if results else "No observations recorded yet."

    return {
        "test_code": test.test_code,
        "status": test.status.value,
        "total_observations": len(results),
        "passed": len(passed),
        "failed": len(failed),
        "major_deviations": major_deviations,
        "summary_text": text,
    }


def lab_insight(db: Session) -> dict:
    """
    Deterministic, lab-wide rollup for the Dashboard's AI Insight card.
    Always available (no LLM key required) since it's built from real
    aggregate counts, not generated text.
    """
    all_results = db.query(TestResult).order_by(TestResult.calculated_at.desc()).limit(200).all()
    recent_fails = [r for r in all_results[:20] if r.result == "FAIL"]
    pending = db.query(Test).filter(Test.status == "UNDER_REVIEW").count()

    if not all_results:
        text = "No test observations recorded yet. Insights will appear here once testing begins."
    elif recent_fails:
        text = (
            f"{len(recent_fails)} of the last 20 observations failed acceptance criteria. "
            f"{pending} test(s) are currently awaiting reviewer sign-off."
        )
    else:
        text = (
            f"All of the last {min(20, len(all_results))} observations are within acceptable limits. "
            f"No anomalies detected in recent tests."
            + (f" {pending} test(s) awaiting review." if pending else "")
        )

    return {
        "summary_text": text,
        "recent_fail_count": len(recent_fails),
        "pending_review_count": pending,
        "sample_size": min(20, len(all_results)),
    }


# ---------------------------------------------------------------------------
# 4. Natural Language Search (keyword-routed, deterministic — no hallucinated data)
# ---------------------------------------------------------------------------

def natural_language_search(db: Session, query: str) -> dict:
    q = query.lower().strip()

    # "show failed tests for <instrument code/serial/model>"
    if "fail" in q:
        target = None
        for instrument in db.query(Instrument).all():
            if instrument.model.lower() in q or instrument.serial_number.lower() in q or instrument.instrument_code.lower() in q:
                target = instrument
                break
        results_q = (
            db.query(TestResult)
            .join(Test, TestResult.test_id == Test.id)
            .filter(TestResult.result == "FAIL")
        )
        if target:
            results_q = results_q.filter(Test.instrument_id == target.id)
        rows = results_q.order_by(TestResult.calculated_at.desc()).limit(20).all()
        return {
            "interpreted_as": f"failed test results" + (f" for {target.model} ({target.serial_number})" if target else ""),
            "count": len(rows),
            "results": [
                {"test_code": r.test.test_code, "result": r.result,
                 "criterion": r.criterion_display, "values": r.calculated_values,
                 "date": r.calculated_at.isoformat()}
                for r in rows
            ],
        }

    # "show reports/tests from this month"
    if "this month" in q or "reports from" in q or "tests from" in q:
        now = datetime.now(timezone.utc)
        start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        rows = db.query(Test).filter(Test.test_date >= start_of_month).order_by(Test.test_date.desc()).all()
        return {
            "interpreted_as": "tests recorded this month",
            "count": len(rows),
            "results": [{"test_code": t.test_code, "status": t.status.value, "test_date": t.test_date.isoformat()} for t in rows],
        }

    # "which instrument had the highest deviation"
    if "highest deviation" in q or "largest deviation" in q or "biggest deviation" in q:
        best = None
        best_val = -1.0
        for r in db.query(TestResult).all():
            cv = r.calculated_values or {}
            val = abs(cv.get("error", cv.get("variation", cv.get("max_abs_error", 0)) or 0))
            if val > best_val:
                best_val = val
                best = r
        if not best:
            return {"interpreted_as": "instrument with highest deviation", "count": 0, "results": []}
        instrument = best.test.instrument
        return {
            "interpreted_as": "instrument with highest recorded deviation",
            "count": 1,
            "results": [{
                "instrument": f"{instrument.model} ({instrument.serial_number})",
                "deviation": best_val,
                "test_code": best.test.test_code,
                "result": best.result,
            }],
        }

    return {
        "interpreted_as": "unrecognized query",
        "count": 0,
        "results": [],
        "message": "Try phrasing like: 'show failed tests for ABC-100', 'show reports from this month', or 'which instrument had the highest deviation'.",
    }


# ---------------------------------------------------------------------------
# 5. Conversational Chat — the AI Laboratory Assistant chatbot
# ---------------------------------------------------------------------------

def _count_instruments(db: Session) -> dict:
    rows = db.query(Instrument).all()
    return {
        "interpreted_as": "instrument count",
        "count": len(rows),
        "results": [{"model": i.model, "serial_number": i.serial_number, "class": i.accuracy_class} for i in rows],
    }


def _list_pending_reviews(db: Session) -> dict:
    rows = db.query(Test).filter(Test.status == "UNDER_REVIEW").all()
    return {
        "interpreted_as": "tests pending review",
        "count": len(rows),
        "results": [{"test_code": t.test_code, "instrument": t.instrument.model} for t in rows],
    }


def _test_status_lookup(db: Session, q: str) -> Optional[dict]:
    for test in db.query(Test).all():
        if test.test_code.lower() in q:
            results = db.query(TestResult).filter(TestResult.test_id == test.id).all()
            overall = "PASS" if results and all(r.result == "PASS" for r in results) else ("FAIL" if results else "PENDING")
            return {
                "interpreted_as": f"status of {test.test_code}",
                "count": 1,
                "results": [{"test_code": test.test_code, "status": test.status.value, "overall_result": overall}],
            }
    return None


def _format_data_answer(routed: dict) -> str:
    """Turns a structured NL-search/router result into a natural sentence for the chat UI."""
    count = routed.get("count", 0)
    interpreted = routed.get("interpreted_as", "your query")
    if routed.get("message") and count == 0:
        return routed["message"]
    if count == 0:
        return f"I didn't find any results for {interpreted}."

    results = routed.get("results", [])
    lines = [f"Found {count} result(s) for {interpreted}:"]
    for r in results[:8]:
        parts = ", ".join(f"{k}: {v}" for k, v in r.items())
        lines.append(f"• {parts}")
    if count > 8:
        lines.append(f"…and {count - 8} more.")
    return "\n".join(lines)


CHAT_SYSTEM_PROMPT = (
    "You are the WeighSure AI Laboratory Assistant, embedded in a NAWI (weighing instrument) "
    "compliance testing platform built around OIML R 76. You help lab engineers and reviewers "
    "understand their test data, instruments, and workflow. You are NOT the compliance authority — "
    "PASS/FAIL decisions are made by a separate deterministic rule engine and are provided to you as "
    "fact; never contradict or second-guess them. Be concise, practical, and specific. If asked something "
    "outside the lab's data (general chit-chat, unrelated topics), politely redirect to what you can help with: "
    "instruments, tests, results, reports, and OIML R 76 testing procedures in general terms."
)

LANG_NAMES = {"en": "English", "hi": "Hindi (हिन्दी)", "ta": "Tamil (தமிழ்)"}

FALLBACK_HELP_TEXT = {
    "en": (
        "I can help you look up lab data directly — try asking things like "
        "'how many instruments do we have', 'show failed tests for ABC-100', "
        "'tests pending review', 'status of TST-2026-0001', or 'which instrument had the "
        "highest deviation'. For open-ended questions, connect an AI provider API key "
        "in Settings to enable free-form conversation."
    ),
    "hi": (
        "मैं सीधे लैब डेटा खोजने में आपकी मदद कर सकता हूँ — जैसे 'हमारे पास कितने उपकरण हैं', "
        "'ABC-100 के लिए विफल परीक्षण दिखाएं', 'समीक्षा हेतु लंबित परीक्षण', 'TST-2026-0001 की स्थिति', "
        "या 'किस उपकरण में सबसे अधिक विचलन था' पूछ कर देखें। खुले प्रश्नों के लिए, सेटिंग्स में एक AI प्रदाता "
        "API कुंजी जोड़ें ताकि मुक्त-रूप बातचीत सक्षम हो सके।"
    ),
    "ta": (
        "நான் நேரடியாக ஆய்வக தரவைத் தேட உதவ முடியும் — 'எங்களிடம் எத்தனை கருவிகள் உள்ளன', "
        "'ABC-100க்கான தோல்வியுற்ற சோதனைகளைக் காட்டு', 'மதிப்பாய்வுக்கு நிலுவையில் உள்ள சோதனைகள்', "
        "'TST-2026-0001 இன் நிலை', அல்லது 'எந்த கருவியில் அதிக விலகல் இருந்தது' போன்றவற்றைக் கேட்டுப் "
        "பாருங்கள். திறந்த-முடிவு கேள்விகளுக்கு, அமைப்புகளில் AI வழங்குநர் API விசையை இணைக்கவும்."
    ),
}


def chat_response(db: Session, message: str, lang: str = "en") -> dict:
    """
    Routes a free-text chat message to structured lab-data lookups where possible
    (deterministic, no hallucination risk), and falls back to a general LLM reply
    for anything conversational. Returns {"response": str, "data": dict|None}.
    """
    q = message.lower().strip()

    # Try structured routes first — these never hallucinate since they query the DB directly.
    structured: Optional[dict] = None
    if "how many instrument" in q or ("list" in q and "instrument" in q):
        structured = _count_instruments(db)
    elif "pending review" in q or "awaiting review" in q or "under review" in q:
        structured = _list_pending_reviews(db)
    elif any(code_hint in q for code_hint in ["tst-", "status of"]):
        structured = _test_status_lookup(db, q)
    elif any(kw in q for kw in ["fail", "this month", "reports from", "tests from", "highest deviation", "largest deviation", "biggest deviation"]):
        structured = natural_language_search(db, message)

    if structured is not None:
        data_answer = _format_data_answer(structured)
        # If an LLM is available, ask it to translate/naturalize the structured
        # answer into the requested language — the underlying facts (from the
        # DB query above) never change, only the phrasing/language does.
        if lang != "en":
            try:
                translated = generate(
                    f"Translate and lightly naturalize the following lab-assistant response into "
                    f"{LANG_NAMES.get(lang, lang)}. Keep all facts, numbers, codes, and IDs exactly as given — "
                    f"do not add or remove information.",
                    data_answer,
                    max_tokens=400,
                    db=db,
                )
                return {"response": translated, "data": structured}
            except LLMUnavailable:
                pass
        return {"response": data_answer, "data": structured}

    # No structured match — try a general LLM reply grounded by the system prompt.
    try:
        lang_instruction = f" Respond in {LANG_NAMES.get(lang, lang)}." if lang != "en" else ""
        reply = generate(CHAT_SYSTEM_PROMPT + lang_instruction, message, max_tokens=400, db=db)
        return {"response": reply, "data": None}
    except LLMUnavailable:
        return {"response": FALLBACK_HELP_TEXT.get(lang, FALLBACK_HELP_TEXT["en"]), "data": None}
