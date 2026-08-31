import { useEffect, useState, type FormEvent } from "react";
import { Plus, X } from "lucide-react";
import { AppShell, PageHeader } from "../components/AppShell";
import { useLang } from "../lib/lang";
import { api, ApiError, type Instrument } from "../lib/api";

const emptyForm = {
  manufacturer: "",
  model: "",
  serial_number: "",
  instrument_type: "",
  accuracy_class: "III",
  max_capacity: "",
  min_capacity: "",
  verification_scale_interval: "",
  display_resolution: "",
  owner_customer: "",
  remarks: "",
};

export function Instruments() {
  const { t } = useLang();
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const data = await api.get<Instrument[]>("/instruments");
    setInstruments(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.post("/instruments", {
        manufacturer: form.manufacturer,
        model: form.model,
        serial_number: form.serial_number,
        instrument_type: form.instrument_type,
        accuracy_class: form.accuracy_class,
        max_capacity: parseFloat(form.max_capacity),
        min_capacity: parseFloat(form.min_capacity),
        verification_scale_interval: parseFloat(form.verification_scale_interval),
        display_resolution: form.display_resolution ? parseFloat(form.display_resolution) : null,
        owner_customer: form.owner_customer || null,
        remarks: form.remarks || null,
      });
      setForm(emptyForm);
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to register instrument");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <PageHeader
        title={t("instr.title")}
        subtitle={t("instr.subtitle")}
        action={
          <button
            onClick={() => setShowForm((s) => !s)}
            className="flex items-center gap-1.5 rounded-md bg-ink text-white text-sm font-medium px-4 py-2 hover:bg-ink-light transition-colors"
          >
            {showForm ? <X size={15} /> : <Plus size={15} />}
            {showForm ? t("instr.cancel") : t("instr.register")}
          </button>
        }
      />

      <div className="p-8 space-y-6">
        {showForm && (
          <form onSubmit={onSubmit} className="bg-surface-raised border border-hairline rounded-lg p-6 grid grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label={t("instr.manufacturer")} required value={form.manufacturer} onChange={(v) => setForm({ ...form, manufacturer: v })} />
            <Field label={t("instr.model")} required value={form.model} onChange={(v) => setForm({ ...form, model: v })} />
            <Field label={t("instr.serial")} required value={form.serial_number} onChange={(v) => setForm({ ...form, serial_number: v })} />
            <Field label={t("instr.type")} required value={form.instrument_type} onChange={(v) => setForm({ ...form, instrument_type: v })} placeholder="Platform Scale" />
            <div>
              <label className="text-xs font-medium text-steel">{t("instr.class")}</label>
              <select
                value={form.accuracy_class}
                onChange={(e) => setForm({ ...form, accuracy_class: e.target.value })}
                className="mt-1 w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm outline-none focus:border-brass"
              >
                {["I", "II", "III", "IIII"].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <Field label={t("instr.maxcap")} required type="number" step="any" value={form.max_capacity} onChange={(v) => setForm({ ...form, max_capacity: v })} />
            <Field label={t("instr.mincap")} required type="number" step="any" value={form.min_capacity} onChange={(v) => setForm({ ...form, min_capacity: v })} />
            <Field label={t("instr.e")} required type="number" step="any" value={form.verification_scale_interval} onChange={(v) => setForm({ ...form, verification_scale_interval: v })} />
            <Field label={t("instr.resolution")} type="number" step="any" value={form.display_resolution} onChange={(v) => setForm({ ...form, display_resolution: v })} />
            <Field label={t("instr.owner")} value={form.owner_customer} onChange={(v) => setForm({ ...form, owner_customer: v })} />
            <div className="col-span-2 lg:col-span-3">
              <label className="text-xs font-medium text-steel">{t("instr.remarks")}</label>
              <textarea
                value={form.remarks}
                onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                className="mt-1 w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm outline-none focus:border-brass"
                rows={2}
              />
            </div>
            {error && <div className="col-span-full text-sm text-fail bg-fail-bg rounded-md px-3 py-2">{error}</div>}
            <div className="col-span-full">
              <button disabled={busy} className="rounded-md bg-brass text-white text-sm font-medium px-5 py-2 hover:bg-brass-light transition-colors disabled:opacity-50">
                {busy ? t("instr.submitting") : t("instr.submit")}
              </button>
            </div>
          </form>
        )}

        <div className="bg-surface-raised border border-hairline rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-steel border-b border-hairline">
                <th className="px-5 py-3 font-medium">{t("instr.col.code")}</th>
                <th className="px-5 py-3 font-medium">{t("instr.col.mm")}</th>
                <th className="px-5 py-3 font-medium">{t("instr.serial")}</th>
                <th className="px-5 py-3 font-medium">{t("instr.col.class")}</th>
                <th className="px-5 py-3 font-medium">{t("instr.col.capacity")}</th>
                <th className="px-5 py-3 font-medium">e</th>
                <th className="px-5 py-3 font-medium">{t("instr.col.owner")}</th>
              </tr>
            </thead>
            <tbody>
              {instruments.map((i) => (
                <tr key={i.id} className="border-b border-hairline last:border-0 hover:bg-surface">
                  <td className="px-5 py-3 font-mono text-xs">{i.instrument_code}</td>
                  <td className="px-5 py-3">{i.manufacturer} — {i.model}</td>
                  <td className="px-5 py-3 font-mono text-xs">{i.serial_number}</td>
                  <td className="px-5 py-3">{i.accuracy_class}</td>
                  <td className="px-5 py-3 font-mono text-xs">{i.min_capacity}–{i.max_capacity} kg</td>
                  <td className="px-5 py-3 font-mono text-xs">{i.verification_scale_interval}</td>
                  <td className="px-5 py-3 text-steel">{i.owner_customer ?? "—"}</td>
                </tr>
              ))}
              {!loading && instruments.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-sm text-steel">
                    {t("instr.none")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}

function Field({
  label, value, onChange, required, type = "text", step, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void; required?: boolean; type?: string; step?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-steel">{label}{required && " *"}</label>
      <input
        type={type}
        step={step}
        required={required}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm outline-none focus:border-brass"
      />
    </div>
  );
}
