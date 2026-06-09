import { useEffect, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
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
    actorEmail?: string;
    actorName?: string;
    actorUserId?: string;
    requestIp?: string;
  };
  user?: { _id?: string; email?: string; name?: string } | string | null;
  createdAt: string;
}

const AuditLogsPage = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [typeFilter, setTypeFilter] = useState("");
  const [actorFilter, setActorFilter] = useState("");
  const [resultFilter, setResultFilter] = useState("");
  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);
  const { t } = useI18n();

  const getFilterParams = () => ({
    type: typeFilter.trim() || undefined,
    actor: actorFilter.trim() || undefined,
    result: resultFilter || undefined,
    from: fromDate?.toISOString(),
    to: toDate?.toISOString(),
  });

  const load = () => {
    api.get<{ data: AuditLog[] }>("/audit", { params: getFilterParams() }).then((res) => setLogs(res.data.data));
  };

  useEffect(() => {
    load();
  }, []);

  const getActor = (log: AuditLog) => {
    if (log.user && typeof log.user === "object") {
      return log.user.email || log.user.name || log.user._id || "-";
    }
    if (typeof log.user === "string") return `${t("deletedUser") || "Deleted user"} (${log.user})`;
    if (log.metadata?.actorEmail || log.metadata?.actorName) {
      return log.metadata.actorEmail || log.metadata.actorName || "-";
    }
    if (log.metadata?.actorUserId) {
      return `${t("deletedUser") || "Deleted user"} (${log.metadata.actorUserId})`;
    }
    if (log.metadata?.requestIp) {
      return `${t("unauthenticatedRequest") || "Unauthenticated request"} (${log.metadata.requestIp})`;
    }
    return t("systemRequest") || "System request";
  };

  const renderAction = (log: AuditLog) => {
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
      <div className="page-header" style={{ padding: 0, marginBottom: 12 }}>
        <form
          className="filters"
          onSubmit={(e) => {
            e.preventDefault();
            load();
          }}
        >
          <input
            className="filter-input"
            placeholder={t("audit.type") || "Type"}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          />
          <input
            className="filter-input"
            placeholder={t("audit.actor") || "Actor"}
            value={actorFilter}
            onChange={(e) => setActorFilter(e.target.value)}
          />
          <select className="filter-select" value={resultFilter} onChange={(e) => setResultFilter(e.target.value)}>
            <option value="">{t("audit.result") || "Result"}</option>
            <option value="SUCCESS">{t("audit.result.success") || "Success"}</option>
            <option value="FAILURE">{t("audit.result.failure") || "Failure"}</option>
          </select>
          <DatePicker
            className="filter-input date-picker"
            selected={fromDate}
            onChange={(date: Date | null) => setFromDate(date)}
            placeholderText={t("from") || "From"}
            showTimeInput
            timeFormat="HH:mm"
            timeIntervals={15}
            dateFormat="yyyy-MM-dd HH:mm"
            isClearable
          />
          <DatePicker
            className="filter-input date-picker"
            selected={toDate}
            onChange={(date: Date | null) => setToDate(date)}
            placeholderText={t("till") || "Till"}
            showTimeInput
            timeFormat="HH:mm"
            timeIntervals={15}
            dateFormat="yyyy-MM-dd HH:mm"
            isClearable
          />
          <button className="ghost-btn" type="submit">
            {t("filter")}
          </button>
          <button
            className="ghost-btn"
            type="button"
            onClick={() => {
              setTypeFilter("");
              setActorFilter("");
              setResultFilter("");
              setFromDate(null);
              setToDate(null);
              api.get<{ data: AuditLog[] }>("/audit").then((res) => setLogs(res.data.data));
            }}
          >
            {t("clear")}
          </button>
        </form>
      </div>
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
