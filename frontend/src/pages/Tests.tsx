import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { AppShell, PageHeader } from "../components/AppShell";
import { StatusBadge } from "../components/Badges";
import { useLang } from "../lib/lang";
import { api, type TestRecord, type Instrument } from "../lib/api";

export function Tests() {
  const { t } = useLang();
  const [tests, setTests] = useState<TestRecord[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [tst, i] = await Promise.all([
        api.get<TestRecord[]>("/tests"),
        api.get<Instrument[]>("/instruments"),
      ]);
      setTests(tst);
      setInstruments(i);
      setLoading(false);
    })();
  }, []);

  return (
    <AppShell>
      <PageHeader
        title={t("tests.title")}
        subtitle={t("tests.subtitle")}
        action={
          <Link to="/tests/new" className="flex items-center gap-1.5 rounded-md bg-ink text-white text-sm font-medium px-4 py-2 hover:bg-ink-light transition-colors">
            <Plus size={15} /> {t("tests.new")}
          </Link>
        }
      />
      <div className="p-8">
        <div className="bg-surface-raised border border-hairline rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-steel border-b border-hairline">
                <th className="px-5 py-3 font-medium">{t("col.testcode")}</th>
                <th className="px-5 py-3 font-medium">{t("col.instrument")}</th>
                <th className="px-5 py-3 font-medium">{t("tests.testdate")}</th>
                <th className="px-5 py-3 font-medium">{t("col.status")}</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {tests.map((tst) => {
                const instrument = instruments.find((i) => i.id === tst.instrument_id);
                return (
                  <tr key={tst.id} className="border-b border-hairline last:border-0 hover:bg-surface">
                    <td className="px-5 py-3 font-mono text-xs">{tst.test_code}</td>
                    <td className="px-5 py-3">{instrument ? `${instrument.model} (${instrument.serial_number})` : "—"}</td>
                    <td className="px-5 py-3 text-steel text-xs">{new Date(tst.test_date).toLocaleDateString()}</td>
                    <td className="px-5 py-3"><StatusBadge status={tst.status} /></td>
                    <td className="px-5 py-3 text-right">
                      <Link to={`/tests/${tst.id}`} className="text-xs text-ink-light font-medium hover:underline">{t("action.open")}</Link>
                    </td>
                  </tr>
                );
              })}
              {!loading && tests.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-steel">{t("tests.none")}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
