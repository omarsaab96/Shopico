import { useEffect, useState } from "react";
import Card from "../components/Card";
import StatusPill from "../components/StatusPill";
import { fetchTopUps, updateTopUp } from "../api/client";
import type { WalletTopUp } from "../types/api";
import { useI18n } from "../context/I18nContext";

const WalletPage = () => {
  const [topups, setTopups] = useState<WalletTopUp[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [methodFilter, setMethodFilter] = useState("");
  const { t, tStatus } = useI18n();

  const getFilterParams = () => ({
    q: searchTerm.trim() || undefined,
    status: statusFilter || undefined,
    method: methodFilter || undefined,
  });

  const load = () => fetchTopUps(getFilterParams()).then(setTopups);
  useEffect(() => {
    load();
  }, []);

  return (
    <Card title={t("titles.wallet")} subTitle={`(${topups.length})`}>
      <div className="page-header" style={{ padding: 0, marginBottom: 12 }}>
        <div className="filters">
          <input
            className="filter-input"
            placeholder={t("searchTopup")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select className="filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">{t("status")}</option>
            <option value="PENDING">{tStatus("PENDING")}</option>
            <option value="APPROVED">{tStatus("APPROVED")}</option>
            <option value="REJECTED">{tStatus("REJECTED")}</option>
          </select>
          <select className="filter-select" value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)}>
            <option value="">{t("method")}</option>
            <option value="CASH_STORE">{t("method")} (store)</option>
            <option value="SHAM_CASH">Sham Cash</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
          </select>
          <button className="ghost-btn" type="button" onClick={load}>
            {t("filter")}
          </button>
          <button
            className="ghost-btn"
            type="button"
            onClick={() => {
              setSearchTerm("");
              setStatusFilter("");
              setMethodFilter("");
              fetchTopUps().then(setTopups);
            }}
          >
            {t("clear")}
          </button>
        </div>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>{t("customer")}</th>
            <th>{t("amount")}</th>
            <th>{t("method")}</th>
            <th>{t("status")}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {topups.length == 0 ? (
            <tr>
              <td colSpan={6} className="muted">{t("noTopups")}</td>
            </tr>
          ) : (
            topups.map((topup) => (
              <tr key={topup._id}>
                <td>{typeof topup.user === "string" ? topup.user : topup.user.email}</td>
                <td>{topup.amount.toLocaleString()}</td>
                <td>{topup.method}</td>
                <td>
                  <StatusPill value={topup.status} />
                </td>
                <td>
                  <button className="ghost-btn" onClick={() => updateTopUp(topup._id, "APPROVED").then(load)}>
                    {t("approve")}
                  </button>
                  <button className="ghost-btn danger" onClick={() => updateTopUp(topup._id, "REJECTED").then(load)}>
                    {t("reject")}
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </Card>
  );
};

export default WalletPage;
