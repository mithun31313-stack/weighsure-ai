import { useEffect, useState } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { AppShell, PageHeader } from "../components/AppShell";
import { useLang } from "../lib/lang";
import { api, TEST_TYPES, type TestRecord, type TestResultRecord } from "../lib/api";

export function Analytics() {
  const { t } = useLang();
  const [loading, setLoading] = useState(true);
  const [passFailTrend, setPassFailTrend] = useState<{ date: string; pass: number; fail: number }[]>([]);
  const [byTestType, setByTestType] = useState<{ type: string; pass: number; fail: number }[]>([]);

  useEffect(() => {
    (async () => {
      const tests = await api.get<TestRecord[]>("/tests");
      const resultLists = await Promise.all(
        tests.map((tst) => api.get<TestResultRecord[]>(`/tests/${tst.id}/results`))
      );

      // Pass/fail trend by day
      const byDate: Record<string, { pass: number; fail: number }> = {};
      resultLists.flat().forEach((r) => {
        const day = new Date(r.calculated_at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
        byDate[day] ??= { pass: 0, fail: 0 };
        if (r.result === "PASS") byDate[day].pass++;
        else byDate[day].fail++;
      });
      setPassFailTrend(Object.entries(byDate).map(([date, v]) => ({ date, ...v })));

      // Results by test type — now that the API exposes test_type_code, this is a real aggregation.
      const typeLabelByCode = Object.fromEntries(TEST_TYPES.map((tt) => [tt.code, tt.label]));
      const typeCounts: Record<string, { pass: number; fail: number }> = {};
      TEST_TYPES.forEach((tt) => { typeCounts[tt.label] = { pass: 0, fail: 0 }; });
      resultLists.flat().forEach((r) => {
        const label = r.test_type_code ? typeLabelByCode[r.test_type_code] : undefined;
        if (!label) return;
        if (r.result === "PASS") typeCounts[label].pass++;
        else typeCounts[label].fail++;
      });
      setByTestType(Object.entries(typeCounts).map(([type, v]) => ({ type, ...v })));

      setLoading(false);
    })();
  }, []);

  return (
    <AppShell>
      <PageHeader title={t("analytics.title")} subtitle={t("analytics.subtitle")} />
      <div className="p-8 space-y-6">
        {loading ? (
          <div className="text-sm text-steel">{t("dash.loading")}</div>
        ) : (
          <>
            <div className="bg-surface-raised border border-hairline rounded-lg p-5">
              <div className="text-sm font-semibold text-ink mb-4">{t("analytics.trend")}</div>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={passFailTrend}>
                  <CartesianGrid stroke="#dde3e9" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#4a6178" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#4a6178" allowDecimals={false} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="pass" stroke="#1f7a4d" strokeWidth={2} name={t("dash.passed")} />
                  <Line type="monotone" dataKey="fail" stroke="#b0332b" strokeWidth={2} name={t("dash.failed")} />
                </LineChart>
              </ResponsiveContainer>
              {passFailTrend.length === 0 && (
                <p className="text-xs text-steel text-center mt-2">{t("dash.notests")}</p>
              )}
            </div>

            <div className="bg-surface-raised border border-hairline rounded-lg p-5">
              <div className="text-sm font-semibold text-ink mb-4">{t("analytics.bytesttype")}</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={byTestType}>
                  <CartesianGrid stroke="#dde3e9" vertical={false} />
                  <XAxis dataKey="type" tick={{ fontSize: 10 }} stroke="#4a6178" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#4a6178" allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="pass" stackId="a" fill="#1f7a4d" name={t("dash.passed")} />
                  <Bar dataKey="fail" stackId="a" fill="#b0332b" name={t("dash.failed")} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
