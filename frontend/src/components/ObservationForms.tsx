export function WeighingPerformanceForm({
  reference, indicated, onChange,
}: { reference: string; indicated: string; onChange: (field: "reference" | "indicated", v: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-4 max-w-md">
      <NumField label="Reference Mass (kg)" value={reference} onChange={(v) => onChange("reference", v)} />
      <NumField label="Indicated Value (kg)" value={indicated} onChange={(v) => onChange("indicated", v)} />
    </div>
  );
}

export function RepeatabilityForm({
  trials, onChange,
}: { trials: string[]; onChange: (index: number, v: string) => void }) {
  return (
    <div className="grid grid-cols-5 gap-3 max-w-lg">
      {trials.map((t, i) => (
        <NumField key={i} label={`Trial ${i + 1}`} value={t} onChange={(v) => onChange(i, v)} />
      ))}
    </div>
  );
}

export function ZeroTestForm({
  values, onChange,
}: {
  values: { initial_zero: string; loaded_condition: string; unloaded_condition: string; final_zero: string };
  onChange: (field: keyof typeof values, v: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 max-w-md">
      <NumField label="Initial Zero (kg)" value={values.initial_zero} onChange={(v) => onChange("initial_zero", v)} />
      <NumField label="Loaded Condition (kg)" value={values.loaded_condition} onChange={(v) => onChange("loaded_condition", v)} />
      <NumField label="Unloaded Condition (kg)" value={values.unloaded_condition} onChange={(v) => onChange("unloaded_condition", v)} />
      <NumField label="Final Zero (kg)" value={values.final_zero} onChange={(v) => onChange("final_zero", v)} />
    </div>
  );
}

export function TareTestForm({
  values, onChange,
}: {
  values: { gross_weight: string; tare_weight: string; expected_net: string };
  onChange: (field: keyof typeof values, v: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-4 max-w-lg">
      <NumField label="Gross Weight (kg)" value={values.gross_weight} onChange={(v) => onChange("gross_weight", v)} />
      <NumField label="Tare Weight (kg)" value={values.tare_weight} onChange={(v) => onChange("tare_weight", v)} />
      <NumField label="Expected Net (kg)" value={values.expected_net} onChange={(v) => onChange("expected_net", v)} />
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs font-medium text-steel">{label}</label>
      <input
        type="number" step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm outline-none focus:border-brass font-mono"
      />
    </div>
  );
}
