export function ResultBadge({ result }: { result: "PASS" | "FAIL" }) {
  const pass = result === "PASS";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold font-mono tracking-wide ${
        pass ? "bg-pass-bg text-pass" : "bg-fail-bg text-fail"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${pass ? "bg-pass" : "bg-fail"}`} />
      {result}
    </span>
  );
}

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  IN_PROGRESS: "bg-warn-bg text-warn",
  COMPLETED: "bg-blue-50 text-ink-light",
  UNDER_REVIEW: "bg-blue-50 text-ink-light",
  APPROVED: "bg-pass-bg text-pass",
  REJECTED: "bg-fail-bg text-fail",
  FINALIZED: "bg-ink text-white",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-[11px] font-semibold font-mono tracking-wide ${
        STATUS_STYLES[status] ?? "bg-slate-100 text-slate-600"
      }`}
    >
      {status.replace("_", " ")}
    </span>
  );
}
