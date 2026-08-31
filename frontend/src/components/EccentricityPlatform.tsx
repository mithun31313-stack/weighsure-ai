interface PositionValue {
  reference_mass: string;
  indicated_value: string;
}

interface EccentricityPlatformProps {
  values: Record<string, PositionValue>;
  onChange: (position: string, field: keyof PositionValue, value: string) => void;
  results?: Record<string, { error: number }>;
}

// 5-position cross layout: A top-left, B top-right, D bottom-left, C bottom-right, Center middle
const POSITIONS = ["A", "B", "Center", "D", "C"];

export function EccentricityPlatform({ values, onChange, results }: EccentricityPlatformProps) {
  return (
    <div className="grid grid-cols-3 gap-3 max-w-md">
      <PositionCell pos="A" values={values} onChange={onChange} results={results} className="col-start-1 row-start-1" />
      <PositionCell pos="B" values={values} onChange={onChange} results={results} className="col-start-3 row-start-1" />
      <PositionCell pos="Center" values={values} onChange={onChange} results={results} className="col-start-2 row-start-2" />
      <PositionCell pos="D" values={values} onChange={onChange} results={results} className="col-start-1 row-start-3" />
      <PositionCell pos="C" values={values} onChange={onChange} results={results} className="col-start-3 row-start-3" />
    </div>
  );
}

function PositionCell({
  pos, values, onChange, results, className,
}: {
  pos: string;
  values: Record<string, PositionValue>;
  onChange: (position: string, field: keyof PositionValue, value: string) => void;
  results?: Record<string, { error: number }>;
  className: string;
}) {
  const v = values[pos] ?? { reference_mass: "", indicated_value: "" };
  const result = results?.[pos];
  const dotColor = !result ? "bg-hairline" : Math.abs(result.error) === 0 ? "bg-pass" : "bg-brass";

  return (
    <div className={`border border-hairline rounded-lg p-3 bg-white ${className}`}>
      <div className="flex items-center gap-1.5 mb-2">
        <span className={`h-2 w-2 rounded-full ${dotColor}`} />
        <span className="text-xs font-mono font-semibold text-ink">{pos}</span>
      </div>
      <input
        type="number" step="any" placeholder="Ref (kg)"
        value={v.reference_mass}
        onChange={(e) => onChange(pos, "reference_mass", e.target.value)}
        className="w-full text-xs rounded border border-hairline px-2 py-1 mb-1 outline-none focus:border-brass"
      />
      <input
        type="number" step="any" placeholder="Indicated (kg)"
        value={v.indicated_value}
        onChange={(e) => onChange(pos, "indicated_value", e.target.value)}
        className="w-full text-xs rounded border border-hairline px-2 py-1 outline-none focus:border-brass"
      />
    </div>
  );
}

export { POSITIONS };
