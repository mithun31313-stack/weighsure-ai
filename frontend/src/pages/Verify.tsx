import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import { Ruler } from "../components/Ruler";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { useLang } from "../lib/lang";
import { api, ApiError } from "../lib/api";

interface Verification {
  report_id: string;
  instrument_summary: string;
  serial_number: string;
  test_date: string;
  standard_label: string;
  overall_result: "PASS" | "FAIL";
  issuing_laboratory: string;
  verification_status: string;
  tamper_check: "VALID" | "FAILED";
}

export function Verify() {
  const { reportId } = useParams();
  const { t } = useLang();
  const [data, setData] = useState<Verification | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Verification>(`/verify/${reportId}`, false)
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Verification failed"));
  }, [reportId]);

  return (
    <div className="min-h-screen bg-ink flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex justify-end mb-2">
          <LanguageSwitcher dark />
        </div>
        <div className="text-center mb-6">
          <div className="font-display text-xl font-semibold text-white">WeighSure AI</div>
          <div className="text-steel-light text-xs font-mono mt-1">{t("verify.title")}</div>
        </div>

        <div className="bg-white rounded-lg p-6">
          {error && (
            <div className="text-center py-6">
              <ShieldAlert className="mx-auto text-fail mb-3" size={32} />
              <div className="text-sm font-medium text-fail">{error}</div>
              <div className="text-xs text-steel mt-1">{t("verify.notfound")}</div>
            </div>
          )}

          {data && (
            <>
              <div className="flex items-center gap-2 justify-center mb-5">
                {data.verification_status === "AUTHENTIC" && data.tamper_check === "VALID" ? (
                  <ShieldCheck className="text-pass" size={28} />
                ) : (
                  <ShieldAlert className="text-fail" size={28} />
                )}
                <div>
                  <div className="text-sm font-semibold text-ink">
                    {data.verification_status === "AUTHENTIC" ? t("verify.verified") : t("verify.issue")}
                  </div>
                  <div className="text-[11px] text-steel font-mono">{t("verify.tampercheck")}: {data.tamper_check}</div>
                </div>
              </div>

              <Ruler className="mb-5" ticks={30} majorEvery={5} />

              <dl className="space-y-3 text-sm">
                <Row label={t("verify.reportid")} value={data.report_id} mono />
                <Row label={t("verify.instrument")} value={data.instrument_summary} />
                <Row label={t("verify.serial")} value={data.serial_number} mono />
                <Row label={t("verify.testdate")} value={new Date(data.test_date).toLocaleDateString()} />
                <Row label={t("verify.standard")} value={data.standard_label} />
                <Row label={t("verify.lab")} value={data.issuing_laboratory} />
                <Row
                  label={t("verify.result")}
                  value={data.overall_result}
                  valueClass={data.overall_result === "PASS" ? "text-pass font-semibold" : "text-fail font-semibold"}
                />
              </dl>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono, valueClass }: { label: string; value: string; mono?: boolean; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-hairline pb-2">
      <dt className="text-xs text-steel">{label}</dt>
      <dd className={`text-xs ${mono ? "font-mono" : ""} ${valueClass ?? "text-ink"}`}>{value}</dd>
    </div>
  );
}
