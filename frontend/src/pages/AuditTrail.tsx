import { useEffect, useState } from "react";
import { AppShell, PageHeader } from "../components/AppShell";
import { useLang } from "../lib/lang";
import { api, type AuditLogEntry } from "../lib/api";

export function AuditTrail() {
  const { t } = useLang();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<AuditLogEntry[]>("/audit-logs").then((d) => {
      setLogs(d);
      setLoading(false);
    });
  }, []);

  return (
    <AppShell>
      <PageHeader title={t("audit.title")} subtitle={t("audit.subtitle")} />
      <div className="p-8">
        <div className="bg-surface-raised border border-hairline rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-steel border-b border-hairline">
                <th className="px-5 py-3 font-medium">{t("audit.col.time")}</th>
                <th className="px-5 py-3 font-medium">{t("audit.col.action")}</th>
                <th className="px-5 py-3 font-medium">{t("audit.col.entity")}</th>
                <th className="px-5 py-3 font-medium">{t("audit.col.actor")}</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-hairline last:border-0 hover:bg-surface">
                  <td className="px-5 py-3 text-xs font-mono text-steel">{new Date(l.created_at).toLocaleString()}</td>
                  <td className="px-5 py-3 font-mono text-xs text-ink">{l.action}</td>
                  <td className="px-5 py-3 text-xs text-steel">
                    {l.entity_type ? `${l.entity_type} #${l.entity_id}` : "—"}
                  </td>
                  <td className="px-5 py-3 text-xs text-steel">{l.actor_id ? `User #${l.actor_id}` : "—"}</td>
                </tr>
              ))}
              {!loading && logs.length === 0 && (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-sm text-steel">{t("audit.none")}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
