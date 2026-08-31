import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { FlaskConical, Scale, FileText, Sparkles } from "lucide-react";
import { AppShell, PageHeader } from "../components/AppShell";
import { ResultBadge, StatusBadge } from "../components/Badges";
import { LiveInstrument } from "../components/LiveInstrument";
import { useLang } from "../lib/lang";
import { api, type TestRecord, type Instrument, type TestResultRecord, type LabInsight } from "../lib/api";

interface Enriched {
  test: TestRecord;
  instrument?: Instrument;
  results: TestResultRecord[];
}

export function Dashboard() {
  const { t } = useLang();
  const [tests, setTests] = useState<TestRecord[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [resultsByTest, setResultsByTest] = useState<Record<number, TestResultRecord[]>>({});
  const [insight, setInsight] = useState<LabInsight | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [tst, i] = await Promise.all([
        api.get<TestRecord[]>("/tests"),
        api.get<Instrument[]>("/instruments"),
      ]);
      setTests(tst);
      setInstruments(i);
      const entries = await Promise.all(
        tst.slice(0, 30).map(async (test) => [test.id, await api.get<TestResultRecord[]>(`/tests/${test.id}/results`)] as const)
      );
      setResultsByTest(Object.fromEntries(entries));
      api.get<LabInsight>("/ai/lab-insight").then(setInsight).catch(() => {});
      setLoading(false);
    })();
  }, []);

  const enriched: Enriched[] = tests.map((test) => ({
    test,
    instrument: instruments.find((i) => i.id === test.instrument_id),
    results: resultsByTest[test.id] ?? [],
  }));

  const allResults = enriched.flatMap((e) => e.results);
  const passCount = allResults.filter((r) => r.result === "PASS").length;
  const failCount = allResults.filter((r) => r.result === "FAIL").length;
  const inProgress = tests.filter((t) => ["DRAFT", "IN_PROGRESS", "COMPLETED"].includes(t.status)).length;
  const completed = tests.filter((t) => t.status === "FINALIZED").length;
  const pendingReview = tests.filter((t) => t.status === "UNDER_REVIEW").length;

  const classDist = Object.entries(
    instruments.reduce<Record<string, number>>((acc, i) => {
      acc[i.accuracy_class] = (acc[i.accuracy_class] ?? 0) + 1;
      return acc;
    }, {})
  ).map(([klass, count]) => ({ name: `Class ${klass}`, value: count }));

  const monthly = Object.entries(
    tests.reduce<Record<string, number>>((acc, t) => {
      const key = new Date(t.test_date).toLocaleDateString(undefined, { month: "short" });
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {})
  ).map(([month, count]) => ({ month, count }));

  const PIE_COLORS = ["#14243d", "#4a6178", "#b8862e", "#8296a8"];

  return (
    <AppShell>
      <PageHeader title={t("dash.title")} subtitle={t("dash.subtitle")} />
      <div className="p-8 space-y-8">
        {loading ? (
          <div className="text-sm text-steel">{t("dash.loading")}</div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
              <StatCard label={t("dash.instruments")} value={instruments.length} />
              <StatCard label={t("dash.inprogress")} value={inProgress} />
              <StatCard label={t("dash.finalized")} value={completed} />
              <StatCard label={t("dash.passed")} value={passCount} tone="pass" />
              <StatCard label={t("dash.failed")} value={failCount} tone="fail" />
              <StatCard label={t("dash.pendingreview")} value={pendingReview} tone="warn" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-surface-raised border border-hairline rounded-lg p-5">
                <div className="text-sm font-semibold text-ink mb-4">{t("dash.quickstart")}</div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <QuickAction to="/tests/new" icon={<FlaskConical size={18} />} label={t("dash.qa.newtest")} sub={t("dash.qa.newtest.sub")} />
                  <QuickAction to="/instruments" icon={<Scale size={18} />} label={t("dash.qa.addinstrument")} sub={t("dash.qa.addinstrument.sub")} />
                  <QuickAction to="/reports" icon={<FileText size={18} />} label={t("dash.qa.viewreports")} sub={t("dash.qa.viewreports.sub")} />
                  <QuickAction to="/settings" icon={<Sparkles size={18} />} label={t("dash.qa.aiassistant")} sub={t("dash.qa.aiassistant.sub")} />
                </div>
              </div>

              <div className="bg-surface-raised border border-hairline rounded-lg p-5">
                <div className="text-sm font-semibold text-ink mb-3 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-brass" /> {t("dash.aiinsight")}
                </div>
                <p className="text-xs text-steel leading-relaxed">
                  {insight?.summary_text ?? t("dash.loading")}
                </p>
              </div>
            </div>

            <LiveInstrument />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-surface-raised border border-hairline rounded-lg p-5">
                <div className="text-sm font-semibold text-ink mb-4">{t("dash.testsbymonth")}</div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={monthly}>
                    <CartesianGrid stroke="#dde3e9" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#4a6178" />
                    <YAxis tick={{ fontSize: 11 }} stroke="#4a6178" allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#14243d" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-surface-raised border border-hairline rounded-lg p-5">
                <div className="text-sm font-semibold text-ink mb-4">{t("dash.classdist")}</div>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={classDist} dataKey="value" nameKey="name" outerRadius={80} label>
                      {classDist.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-surface-raised border border-hairline rounded-lg overflow-hidden">
              <div className="px-5 py-4 border-b border-hairline text-sm font-semibold text-ink">
                {t("dash.recenttests")}
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-steel border-b border-hairline">
                    <th className="px-5 py-2 font-medium">{t("col.testcode")}</th>
                    <th className="px-5 py-2 font-medium">{t("col.instrument")}</th>
                    <th className="px-5 py-2 font-medium">{t("col.serial")}</th>
                    <th className="px-5 py-2 font-medium">{t("col.date")}</th>
                    <th className="px-5 py-2 font-medium">{t("col.status")}</th>
                    <th className="px-5 py-2 font-medium">{t("col.result")}</th>
                    <th className="px-5 py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {enriched.slice(0, 10).map(({ test, instrument, results }) => {
                    const overall = results.length
                      ? results.every((r) => r.result === "PASS")
                        ? "PASS"
                        : "FAIL"
                      : null;
                    return (
                      <tr key={test.id} className="border-b border-hairline last:border-0 hover:bg-surface">
                        <td className="px-5 py-3 font-mono text-xs">{test.test_code}</td>
                        <td className="px-5 py-3">{instrument?.model ?? "—"}</td>
                        <td className="px-5 py-3 font-mono text-xs">{instrument?.serial_number ?? "—"}</td>
                        <td className="px-5 py-3 text-steel text-xs">
                          {new Date(test.test_date).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-3">
                          <StatusBadge status={test.status} />
                        </td>
                        <td className="px-5 py-3">{overall ? <ResultBadge result={overall} /> : "—"}</td>
                        <td className="px-5 py-3 text-right">
                          <Link to={`/tests/${test.id}`} className="text-xs text-ink-light font-medium hover:underline">
                            {t("action.open")}
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                  {enriched.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-5 py-8 text-center text-sm text-steel">
                        {t("dash.notests")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "pass" | "fail" | "warn" }) {
  const toneClass =
    tone === "pass" ? "text-pass" : tone === "fail" ? "text-fail" : tone === "warn" ? "text-warn" : "text-ink";
  return (
    <div className="bg-surface-raised border border-hairline rounded-lg p-4">
      <div className="text-[11px] text-steel font-medium uppercase tracking-wide">{label}</div>
      <div className={`font-display text-2xl font-semibold mt-1 ${toneClass}`}>{value}</div>
    </div>
  );
}

function QuickAction({ to, icon, label, sub }: { to: string; icon: ReactNode; label: string; sub: string }) {
  return (
    <Link
      to={to}
      className="flex flex-col gap-2 rounded-lg border border-hairline p-3 hover:border-brass hover:bg-surface transition-colors"
    >
      <div className="text-brass">{icon}</div>
      <div>
        <div className="text-xs font-semibold text-ink">{label}</div>
        <div className="text-[10px] text-steel mt-0.5">{sub}</div>
      </div>
    </Link>
  );
}
