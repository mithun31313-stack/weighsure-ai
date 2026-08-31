import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell, PageHeader } from "../components/AppShell";
import { useLang } from "../lib/lang";
import { api, ApiError, type Instrument, type TestRecord } from "../lib/api";

interface StandardVersion {
  id: number;
  standard_name: string;
  version_label: string;
  is_demo: boolean;
}

export function NewTest() {
  const { t } = useLang();
  const navigate = useNavigate();
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [versions, setVersions] = useState<StandardVersion[]>([]);
  const [instrumentId, setInstrumentId] = useState<number | "">("");
  const [versionId, setVersionId] = useState<number | "">("");
  const [testDate, setTestDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [tempC, setTempC] = useState("24");
  const [humidity, setHumidity] = useState("50");
  const [refEquipment, setRefEquipment] = useState("Reference Mass Set Class F1");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const [i, v] = await Promise.all([
        api.get<Instrument[]>("/instruments"),
        api.get<StandardVersion[]>("/standards/versions"),
      ]);
      setInstruments(i);
      setVersions(v);
      if (i.length) setInstrumentId(i[0].id);
      if (v.length) setVersionId(v[0].id);
    })();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!instrumentId || !versionId) return;
    setError(null);
    setBusy(true);
    try {
      const test = await api.post<TestRecord>("/tests", {
        instrument_id: instrumentId,
        standard_version_id: versionId,
        test_date: new Date(testDate).toISOString(),
        environmental_conditions: { temp_c: parseFloat(tempC), humidity_pct: parseFloat(humidity) },
        reference_equipment: refEquipment,
      });
      navigate(`/tests/${test.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create test");
    } finally {
      setBusy(false);
    }
  }

  const selectedVersion = versions.find((v) => v.id === versionId);

  return (
    <AppShell>
      <PageHeader title={t("newtest.title")} subtitle={t("newtest.subtitle")} />
      <div className="p-8 max-w-2xl">
        <form onSubmit={onSubmit} className="bg-surface-raised border border-hairline rounded-lg p-6 space-y-5">
          <div>
            <label className="text-xs font-medium text-steel">{t("newtest.instrument")} *</label>
            <select
              required
              value={instrumentId}
              onChange={(e) => setInstrumentId(Number(e.target.value))}
              className="mt-1 w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm outline-none focus:border-brass"
            >
              {instruments.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.model} — {i.serial_number} (Class {i.accuracy_class}, e={i.verification_scale_interval})
                </option>
              ))}
            </select>
            {instruments.length === 0 && (
              <p className="text-xs text-warn mt-1">{t("newtest.noinstruments")}</p>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-steel">{t("newtest.standard")} *</label>
            <select
              required
              value={versionId}
              onChange={(e) => setVersionId(Number(e.target.value))}
              className="mt-1 w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm outline-none focus:border-brass"
            >
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.standard_name} — {v.version_label}{v.is_demo ? " (DEMO)" : ""}
                </option>
              ))}
            </select>
            {selectedVersion?.is_demo && (
              <p className="text-xs text-warn bg-warn-bg rounded px-2 py-1 mt-1.5">
                {t("newtest.demo_warning")}
              </p>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-steel">{t("newtest.date")} *</label>
            <input
              type="datetime-local"
              required
              value={testDate}
              onChange={(e) => setTestDate(e.target.value)}
              className="mt-1 w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm outline-none focus:border-brass"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-steel">{t("newtest.temp")}</label>
              <input
                type="number" step="any"
                value={tempC}
                onChange={(e) => setTempC(e.target.value)}
                className="mt-1 w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm outline-none focus:border-brass"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-steel">{t("newtest.humidity")}</label>
              <input
                type="number" step="any"
                value={humidity}
                onChange={(e) => setHumidity(e.target.value)}
                className="mt-1 w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm outline-none focus:border-brass"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-steel">{t("newtest.refequip")}</label>
            <input
              value={refEquipment}
              onChange={(e) => setRefEquipment(e.target.value)}
              className="mt-1 w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm outline-none focus:border-brass"
            />
          </div>

          {error && <div className="text-sm text-fail bg-fail-bg rounded-md px-3 py-2">{error}</div>}

          <button
            disabled={busy || !instrumentId || !versionId}
            className="rounded-md bg-ink text-white text-sm font-medium px-5 py-2.5 hover:bg-ink-light transition-colors disabled:opacity-50"
          >
            {busy ? t("newtest.creating") : t("newtest.create")}
          </button>
        </form>
      </div>
    </AppShell>
  );
}
