import { useEffect, useState } from "react";
import Card from "../components/Card";
import api from "../api/client";
import { useI18n } from "../context/I18nContext";

interface AuditLog {
  _id: string;
  action: string;
  metadata?: Record<string, unknown>;
  user?: { email: string };
  createdAt: string;
}

const AuditLogsPage = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const { t } = useI18n();

  useEffect(() => {
    api.get<{ data: AuditLog[] }>("/audit").then((res) => setLogs(res.data.data));
  }, []);

  return (
    <Card title={t("auditTrail")} subTitle="">
      <div className="list">
        {logs.map((log) => (
          <div key={log._id} className="list-row">
            <div>
              <div className="muted">{new Date(log.createdAt).toLocaleString()}</div>
              <strong>{log.action}</strong> {log.user?.email && `${t("audit.by")} ${log.user.email}`}
            </div>
            <code>{log.metadata ? JSON.stringify(log.metadata) : "-"}</code>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default AuditLogsPage;
