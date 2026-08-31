import { useEffect, useState } from "react";
import { AppShell, PageHeader } from "../components/AppShell";
import { useLang } from "../lib/lang";
import { api, type Instrument } from "../lib/api";

const CALIBRATION_INTERVAL_DAYS = 365; // demo assumption — real interval is set by regulation/lab policy, not OIML R76 itself

interface Row {
  instrument: Instrument;
  lastTest: Date | null;
  dueDate: Date | null;
  daysRemaining: number | null;
}

export function Calibrations() {
  const { t } = useLang();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Instrument[]>("/instruments").then((instruments) => {
      const now = new Date();
      const computed = instruments.map((instrument): Row => {
        const lastTest = instrument.date_of_test ? new Date(instrument.date_of_test) : null;
        const dueDate = lastTest ? new Date(lastTest.getTime() + CALIBRATION_INTERVAL_DAYS * 86400000) : null;
        const daysRemaining = dueDate ? Math.round((dueDate.getTime() - now.getTime()) / 86400000) : null;
        return { instrument, lastTest, dueDate, daysRemaining };
      });
      computed.sort((a, b) => (a.daysRemaining ?? Infinity) - (b.daysRemaining ?? Infinity));
      setRows(computed);
      setLoading(false);
    });
  }, []);

  return (
    <AppShell>
      <PageHeader title={t("calib.title")} subtitle={t("calib.subtitle")} />
      <div className="p-8">
        <div className="mb-4 text-xs text-steel bg-warn-bg rounded-md px-3 py-2 max-w-2xl">
          {t("calib.assumption")}
        </div>
        <div className="bg-surface-raised border border-hairline rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-steel border-b border-hairline">
                <th className="px-5 py-3 font-medium">{t("instr.col.mm")}</th>
                <th className="px-5 py-3 font-medium">{t("instr.serial")}</th>
                <th className="px-5 py-3 font-medium">{t("calib.lasttest")}</th>
                <th className="px-5 py-3 font-medium">{t("calib.due")}</th>
                <th className="px-5 py-3 font-medium">{t("calib.status")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.instrument.id} className="border-b border-hairline last:border-0 hover:bg-surface">
                  <td className="px-5 py-3">{r.instrument.manufacturer} — {r.instrument.model}</td>
                  <td className="px-5 py-3 font-mono text-xs">{r.instrument.serial_number}</td>
                  <td className="px-5 py-3 text-xs text-steel">{r.lastTest ? r.lastTest.toLocaleDateString() : "—"}</td>
                  <td className="px-5 py-3 text-xs font-mono">{r.dueDate ? r.dueDate.toLocaleDateString() : "—"}</td>
                  <td className="px-5 py-3">
                    {r.daysRemaining === null ? (
                      <span className="text-xs text-steel">{t("calib.notest")}</span>
                    ) : r.daysRemaining < 0 ? (
                      <span className="text-xs font-mono text-fail">{t("calib.overdue")}</span>
                    ) : r.daysRemaining <= 30 ? (
                      <span className="text-xs font-mono text-warn">{t("calib.duesoon")} ({r.daysRemaining}d)</span>
                    ) : (
                      <span className="text-xs font-mono text-pass">{t("calib.ok")}</span>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-steel">{t("instr.none")}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
