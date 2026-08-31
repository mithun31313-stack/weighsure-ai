import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { AppShell, PageHeader } from "../components/AppShell";
import { ResultBadge } from "../components/Badges";
import { useLang } from "../lib/lang";
import { api, type ReportRecord } from "../lib/api";

export function Reports() {
  const { t } = useLang();
  const [reports, setReports] = useState<ReportRecord[]>([]);

  useEffect(() => {
    api.get<ReportRecord[]>("/reports").then(setReports);
  }, []);

  async function download(reportId: string) {
    const token = api.getToken();
    const res = await fetch(api.downloadUrl(`/reports/${reportId}/download`), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${reportId}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell>
      <PageHeader title={t("reports.title")} subtitle={t("reports.subtitle")} />
      <div className="p-8">
        <div className="bg-surface-raised border border-hairline rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-steel border-b border-hairline">
                <th className="px-5 py-3 font-medium">{t("verify.reportid")}</th>
                <th className="px-5 py-3 font-medium">{t("col.result")}</th>
                <th className="px-5 py-3 font-medium">{t("reports.finalized")}</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id} className="border-b border-hairline last:border-0 hover:bg-surface">
                  <td className="px-5 py-3 font-mono text-xs">{r.report_id}</td>
                  <td className="px-5 py-3"><ResultBadge result={r.overall_result} /></td>
                  <td className="px-5 py-3 text-steel text-xs">
                    {r.finalized_at ? new Date(r.finalized_at).toLocaleString() : "—"}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => download(r.report_id)}
                      className="inline-flex items-center gap-1.5 text-xs text-ink-light font-medium hover:underline"
                    >
                      <Download size={12} /> {t("td.download")}
                    </button>
                  </td>
                </tr>
              ))}
              {reports.length === 0 && (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-sm text-steel">{t("reports.none")}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
