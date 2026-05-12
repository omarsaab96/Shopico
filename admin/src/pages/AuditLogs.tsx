import { useEffect, useState } from "react";
import Card from "../components/Card";
import api from "../api/client";
import { useI18n } from "../context/I18nContext";

interface AuditLog {
  _id: string;
  type?: string;
  action: string;
  result?: "SUCCESS" | "FAILURE";
  metadata?: Record<string, unknown> & {
    targetUserId?: string | { email?: string; name?: string };
  };
  user?: { email: string; name?: string };
  createdAt: string;
}

const AuditLogsPage = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const { t } = useI18n();

  useEffect(() => {
    api.get<{ data: AuditLog[] }>("/audit").then((res) => setLogs(res.data.data));
  }, []);

  const getActor = (log: AuditLog) => log.user?.email || log.user?.name || t("unknownUser") || "Unknown user";

  const renderAction = (log: AuditLog) => {
    const actor = log.user?.email || t("unknownUser") || "Unknown user";
    const target =
      typeof log.metadata?.targetUserId === "object"
        ? log.metadata.targetUserId.email || log.metadata.targetUserId.name || String((log.metadata.targetUserId as any)._id || "-")
        : log.metadata?.targetUserId;

    // if (log.action === "ADMIN_TOPUP_REQUEST") {
    //   return `${t("audit.adminTopupRequest") || "Admin created top-up request"} ${t("audit.for") || "for"} ${target || "-"} ${t("audit.by")} ${actor}`;
    // }

    return log.action;
  };

  const renderResult = (log: AuditLog) => {
    if (log.result) return t(`audit.result.${log.result.toLowerCase()}`) || log.result;
    const statusCode = Number(log.metadata?.statusCode || 0);
    if (statusCode >= 400) return t("audit.result.failure") || "Failure";
    if (statusCode > 0) return t("audit.result.success") || "Success";
    return "-";
  };

  return (
    <Card title={t("auditTrail")} subTitle="">
      <table className="table">
        <thead>
          <tr>
            <th>{t("orders.dateTime")}</th>
            <th>{t("audit.type") || "Type"}</th>
            <th>{t("audit.actor") || "Actor"}</th>
            <th>{t("audit.action") || "Action"}</th>
            <th>{t("audit.result") || "Result"}</th>
            <th>{t("audit.details") || "Details"}</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log._id}>
              <td>{new Date(log.createdAt).toLocaleString()}</td>
              <td>{log.type || String(log.metadata?.path || "").split("/").filter(Boolean)[0] || "-"}</td>
              <td>{getActor(log)}</td>
              <td>{renderAction(log)}</td>
              <td>{renderResult(log)}</td>
              <td><code>{log.metadata ? JSON.stringify(log.metadata) : "-"}</code></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
};

export default AuditLogsPage;
