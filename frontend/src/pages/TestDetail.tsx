import { useEffect, useState, useCallback, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { Sparkles, AlertTriangle, Upload, Download, FileCheck2 } from "lucide-react";
import { AppShell, PageHeader } from "../components/AppShell";
import { ResultBadge, StatusBadge } from "../components/Badges";
import { EccentricityPlatform } from "../components/EccentricityPlatform";
import {
  WeighingPerformanceForm, RepeatabilityForm, ZeroTestForm, TareTestForm,
} from "../components/ObservationForms";
import { useAuth } from "../lib/auth";
import { useLang } from "../lib/lang";
import {
  api, ApiError, TEST_TYPES,
  type TestRecord, type Instrument, type TestResultRecord, type AttachmentRecord, type ReportRecord,
} from "../lib/api";

type EccValue = { reference_mass: string; indicated_value: string };

export function TestDetail() {
  const { id } = useParams();
  const testId = Number(id);
  const { user } = useAuth();
  const { t, lang } = useLang();

  const [test, setTest] = useState<TestRecord | null>(null);
  const [instrument, setInstrument] = useState<Instrument | null>(null);
  const [results, setResults] = useState<TestResultRecord[]>([]);
  const [attachments, setAttachments] = useState<AttachmentRecord[]>([]);
  const [report, setReport] = useState<ReportRecord | null>(null);
  const [activeType, setActiveType] = useState<string>(TEST_TYPES[0].code);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Form state
  const [wp, setWp] = useState({ reference: "", indicated: "" });
  const [trials, setTrials] = useState(["", "", "", "", ""]);
  const [ecc, setEcc] = useState<Record<string, EccValue>>({});
  const [zero, setZero] = useState({ initial_zero: "", loaded_condition: "", unloaded_condition: "", final_zero: "" });
  const [tare, setTare] = useState({ gross_weight: "", tare_weight: "", expected_net: "" });

  // AI panel state
  const [explanations, setExplanations] = useState<Record<number, string>>({});
  const [explainBusy, setExplainBusy] = useState<number | null>(null);
  const [anomalyResults, setAnomalyResults] = useState<Record<number, { anomaly: boolean; message: string }>>({});
  const [summary, setSummary] = useState<{ summary_text: string; passed: number; failed: number } | null>(null);
  const [nlQuery, setNlQuery] = useState("");
  const [nlResult, setNlResult] = useState<{ interpreted_as: string; count: number; message?: string } | null>(null);

  const load = useCallback(async () => {
    const t = await api.get<TestRecord>(`/tests/${testId}`);
    setTest(t);
    const [instr, res, atts] = await Promise.all([
      api.get<Instrument>(`/instruments/${t.instrument_id}`),
      api.get<TestResultRecord[]>(`/tests/${testId}/results`),
      api.get<AttachmentRecord[]>(`/tests/${testId}/attachments`),
    ]);
    setInstrument(instr);
    setResults(res);
    setAttachments(atts);
    if (t.status === "FINALIZED") {
      try {
        const reports = await api.get<ReportRecord[]>("/reports");
        setReport(reports.find((r) => r.test_id === t.id) ?? null);
      } catch { /* ignore */ }
    }
    try {
      const s = await api.get<{ summary_text: string; passed: number; failed: number }>(`/ai/summary/${testId}`);
      setSummary(s);
    } catch { /* ignore */ }
  }, [testId]);

  useEffect(() => { load(); }, [load]);

  async function submitObservation(test_type_code: string, payload: Record<string, unknown>) {
    setSubmitError(null);
    setBusy(true);
    try {
      await api.post(`/tests/${testId}/observations`, { test_type_code, payload });
      await load();
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Failed to submit observation");
    } finally {
      setBusy(false);
    }
  }

  async function transition(status: string, comments?: string) {
    setBusy(true);
    try {
      await api.post(`/tests/${testId}/status`, { status, comments });
      await load();
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Transition failed");
    } finally {
      setBusy(false);
    }
  }

  async function finalize() {
    setBusy(true);
    try {
      await api.post(`/tests/${testId}/finalize`);
      await load();
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Finalize failed");
    } finally {
      setBusy(false);
    }
  }

  async function explain(resultId: number) {
    setExplainBusy(resultId);
    try {
      const res = await api.post<{ explanation: string }>(`/ai/explain/${resultId}?lang=${lang}`);
      setExplanations((e) => ({ ...e, [resultId]: res.explanation }));
    } finally {
      setExplainBusy(null);
    }
  }

  async function checkAnomaly(resultId: number, errorValue: number) {
    if (!instrument) return;
    const res = await api.post<{ anomaly: boolean; message: string }>("/ai/anomaly-check", {
      instrument_id: instrument.id, test_type_code: "weighing_performance", new_value: Math.abs(errorValue),
    });
    setAnomalyResults((a) => ({ ...a, [resultId]: res }));
  }

  async function runSearch() {
    if (!nlQuery.trim()) return;
    const res = await api.post<{ interpreted_as: string; count: number; message?: string }>("/ai/search", { query: nlQuery });
    setNlResult(res);
  }

  async function uploadFile(file: File, category: string) {
    const form = new FormData();
    form.append("category", category);
    form.append("file", file);
    await api.postForm(`/tests/${testId}/attachments`, form);
    await load();
  }

  async function downloadReport() {
    if (!report) return;
    const token = api.getToken();
    const res = await fetch(api.downloadUrl(`/reports/${report.report_id}/download`), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.report_id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!test || !instrument) {
    return (
      <AppShell>
        <PageHeader title={t("dash.loading")} />
      </AppShell>
    );
  }

  const canEnterData = user?.role !== "REVIEWER" && ["DRAFT", "IN_PROGRESS"].includes(test.status);
  const canEngineerAdvance = (user?.role === "TEST_ENGINEER" || user?.role === "ADMIN");
  const canReview = (user?.role === "REVIEWER" || user?.role === "ADMIN");

  return (
    <AppShell>
      <PageHeader
        title={test.test_code}
        subtitle={`${instrument.manufacturer} ${instrument.model} — ${instrument.serial_number}`}
        action={<StatusBadge status={test.status} />}
      />

      <div className="p-8 grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          {/* Observation entry */}
          {canEnterData && (
            <div className="bg-surface-raised border border-hairline rounded-lg p-6">
              <div className="text-sm font-semibold text-ink mb-4">{t("td.recordobs")}</div>
              <div className="flex gap-1 mb-5 border-b border-hairline">
                {TEST_TYPES.map((tt) => (
                  <button
                    key={tt.code}
                    onClick={() => setActiveType(tt.code)}
                    className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
                      activeType === tt.code ? "border-brass text-ink" : "border-transparent text-steel hover:text-ink"
                    }`}
                  >
                    {t(`tt.${tt.code}`)}
                  </button>
                ))}
              </div>

              {activeType === "weighing_performance" && (
                <>
                  <WeighingPerformanceForm
                    reference={wp.reference} indicated={wp.indicated}
                    onChange={(f, v) => setWp((s) => ({ ...s, [f]: v }))}
                  />
                  <SubmitBtn busy={busy} onClick={() => submitObservation("weighing_performance", {
                    reference_mass: parseFloat(wp.reference), indicated_value: parseFloat(wp.indicated), unit: "kg",
                  })} />
                </>
              )}

              {activeType === "repeatability" && (
                <>
                  <RepeatabilityForm trials={trials} onChange={(i, v) => setTrials((arr) => arr.map((x, idx) => idx === i ? v : x))} />
                  <SubmitBtn busy={busy} onClick={() => submitObservation("repeatability", {
                    trials: trials.map(Number), unit: "kg",
                  })} />
                </>
              )}

              {activeType === "eccentricity" && (
                <>
                  <EccentricityPlatform
                    values={ecc}
                    onChange={(pos, field, v) => setEcc((s) => ({ ...s, [pos]: { ...(s[pos] ?? { reference_mass: "", indicated_value: "" }), [field]: v } }))}
                  />
                  <SubmitBtn busy={busy} onClick={() => submitObservation("eccentricity", {
                    positions: Object.fromEntries(
                      Object.entries(ecc).map(([k, v]) => [k, { reference_mass: parseFloat(v.reference_mass), indicated_value: parseFloat(v.indicated_value) }])
                    ),
                    unit: "kg",
                  })} />
                </>
              )}

              {activeType === "zero" && (
                <>
                  <ZeroTestForm values={zero} onChange={(f, v) => setZero((s) => ({ ...s, [f]: v }))} />
                  <SubmitBtn busy={busy} onClick={() => submitObservation("zero", {
                    initial_zero: parseFloat(zero.initial_zero), loaded_condition: parseFloat(zero.loaded_condition),
                    unloaded_condition: parseFloat(zero.unloaded_condition), final_zero: parseFloat(zero.final_zero), unit: "kg",
                  })} />
                </>
              )}

              {activeType === "tare" && (
                <>
                  <TareTestForm values={tare} onChange={(f, v) => setTare((s) => ({ ...s, [f]: v }))} />
                  <SubmitBtn busy={busy} onClick={() => submitObservation("tare", {
                    gross_weight: parseFloat(tare.gross_weight), tare_weight: parseFloat(tare.tare_weight),
                    expected_net: parseFloat(tare.expected_net), unit: "kg",
                  })} />
                </>
              )}

              {submitError && <div className="mt-3 text-sm text-fail bg-fail-bg rounded-md px-3 py-2">{submitError}</div>}
            </div>
          )}

          {/* Results */}
          <div className="bg-surface-raised border border-hairline rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-hairline text-sm font-semibold text-ink">{t("td.results")}</div>
            {results.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-steel">{t("td.noresults")}</div>
            ) : (
              <div className="divide-y divide-hairline">
                {results.map((r) => {
                  const errorVal = typeof r.calculated_values.error === "number" ? r.calculated_values.error : null;
                  return (
                    <div key={r.id} className="px-5 py-4">
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-steel font-mono">{r.criterion_display}</div>
                        <ResultBadge result={r.result} />
                      </div>
                      <div className="text-xs font-mono text-ink mt-2 bg-surface rounded px-2 py-1.5">
                        {Object.entries(r.calculated_values).filter(([k]) => k !== "positions").map(([k, v]) => `${k}: ${v}`).join("  ·  ")}
                      </div>
                      <div className="flex gap-3 mt-2">
                        <button
                          onClick={() => explain(r.id)}
                          disabled={explainBusy === r.id}
                          className="flex items-center gap-1 text-xs text-ink-light font-medium hover:underline disabled:opacity-50"
                        >
                          <Sparkles size={12} /> {explainBusy === r.id ? t("td.explaining") : t("td.explain")}
                        </button>
                        {errorVal !== null && (
                          <button
                            onClick={() => checkAnomaly(r.id, errorVal)}
                            className="flex items-center gap-1 text-xs text-steel font-medium hover:underline"
                          >
                            <AlertTriangle size={12} /> {t("td.checkanomaly")}
                          </button>
                        )}
                      </div>
                      {explanations[r.id] && (
                        <div className="mt-2 text-xs text-ink bg-warn-bg border border-warn/20 rounded-md px-3 py-2 leading-relaxed">
                          {explanations[r.id]}
                        </div>
                      )}
                      {anomalyResults[r.id] && (
                        <div className={`mt-2 text-xs rounded-md px-3 py-2 ${anomalyResults[r.id].anomaly ? "bg-fail-bg text-fail" : "bg-pass-bg text-pass"}`}>
                          {anomalyResults[r.id].message}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Attachments */}
          <div className="bg-surface-raised border border-hairline rounded-lg p-5">
            <div className="text-sm font-semibold text-ink mb-3">{t("td.attachments")}</div>
            <div className="space-y-2 mb-3">
              {attachments.map((a) => (
                <div key={a.id} className="flex items-center justify-between text-xs bg-surface rounded px-3 py-2">
                  <span className="text-steel">{a.category.replace("_", " ")}</span>
                  <span className="font-mono">{a.filename}</span>
                </div>
              ))}
              {attachments.length === 0 && <div className="text-xs text-steel">{t("td.nofiles")}</div>}
            </div>
            {test.status !== "FINALIZED" && canEngineerAdvance && (
              <label className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-light cursor-pointer hover:underline">
                <Upload size={13} />
                {t("td.uploadphoto")}
                <input
                  type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f, "setup"); }}
                />
              </label>
            )}
          </div>
        </div>

        {/* Sidebar: workflow + AI assistant */}
        <div className="space-y-6">
          <div className="bg-surface-raised border border-hairline rounded-lg p-5">
            <div className="text-sm font-semibold text-ink mb-3">{t("td.workflow")}</div>
            <div className="space-y-2">
              {test.status === "IN_PROGRESS" && canEngineerAdvance && (
                <ActionBtn onClick={() => transition("COMPLETED")} label={t("td.markcompleted")} />
              )}
              {test.status === "COMPLETED" && canEngineerAdvance && (
                <ActionBtn onClick={() => transition("UNDER_REVIEW")} label={t("td.sendforreview")} />
              )}
              {test.status === "UNDER_REVIEW" && canReview && (
                <>
                  <ActionBtn onClick={() => transition("APPROVED")} label={t("td.approve")} tone="pass" />
                  <ActionBtn onClick={() => transition("REJECTED", "Reviewer requested retest")} label={t("td.reject")} tone="fail" />
                </>
              )}
              {test.status === "REJECTED" && canEngineerAdvance && (
                <ActionBtn onClick={() => transition("IN_PROGRESS")} label={t("td.resume")} />
              )}
              {test.status === "APPROVED" && canReview && (
                <ActionBtn onClick={finalize} label={t("td.finalize")} tone="brass" icon={<FileCheck2 size={14} />} />
              )}
              {test.status === "FINALIZED" && report && (
                <button
                  onClick={downloadReport}
                  className="w-full flex items-center justify-center gap-2 rounded-md bg-ink text-white text-sm font-medium py-2.5 hover:bg-ink-light transition-colors"
                >
                  <Download size={14} /> {t("td.download")} {report.report_id}.pdf
                </button>
              )}
              {!["IN_PROGRESS", "COMPLETED", "UNDER_REVIEW", "REJECTED", "APPROVED"].includes(test.status) && test.status !== "FINALIZED" && (
                <div className="text-xs text-steel">{t("td.needobs")}</div>
              )}
            </div>
          </div>

          <div className="bg-surface-raised border border-hairline rounded-lg p-5">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-ink mb-3">
              <Sparkles size={14} className="text-brass" /> {t("td.aiassistant")}
            </div>
            {summary && (
              <p className="text-xs text-steel leading-relaxed mb-4">{summary.summary_text}</p>
            )}
            <div className="flex gap-2">
              <input
                value={nlQuery}
                onChange={(e) => setNlQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runSearch()}
                placeholder={t("td.asklabdata")}
                className="flex-1 text-xs rounded-md border border-hairline px-2.5 py-1.5 outline-none focus:border-brass"
              />
              <button onClick={runSearch} className="text-xs font-medium text-white bg-ink rounded-md px-3 hover:bg-ink-light">
                {t("td.ask")}
              </button>
            </div>
            {nlResult && (
              <div className="mt-3 text-xs bg-surface rounded-md px-3 py-2 text-steel">
                <div className="font-medium text-ink mb-1">{nlResult.interpreted_as}</div>
                {nlResult.message ?? `${nlResult.count} result(s) found.`}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function SubmitBtn({ onClick, busy }: { onClick: () => void; busy: boolean }) {
  const { t } = useLang();
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="mt-4 rounded-md bg-ink text-white text-sm font-medium px-4 py-2 hover:bg-ink-light transition-colors disabled:opacity-50"
    >
      {busy ? t("td.submitting") : t("td.submit")}
    </button>
  );
}

function ActionBtn({
  onClick, label, tone = "default", icon,
}: { onClick: () => void; label: string; tone?: "default" | "pass" | "fail" | "brass"; icon?: ReactNode }) {
  const toneClass = {
    default: "bg-ink hover:bg-ink-light",
    pass: "bg-pass hover:opacity-90",
    fail: "bg-fail hover:opacity-90",
    brass: "bg-brass hover:bg-brass-light",
  }[tone];
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-center gap-2 rounded-md text-white text-sm font-medium py-2.5 transition-colors ${toneClass}`}
    >
      {icon}{label}
    </button>
  );
}
