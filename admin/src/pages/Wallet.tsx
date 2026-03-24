import { useEffect, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import Card from "../components/Card";
import StatusPill from "../components/StatusPill";
import { createTopUpRequestAdmin, fetchTopUps, updateTopUp } from "../api/client";
import type { WalletTopUp } from "../types/api";
import { useI18n } from "../context/I18nContext";
import { usePermissions } from "../hooks/usePermissions";
import { useBranch } from "../context/BranchContext";

const WalletPage = () => {
  const [topups, setTopups] = useState<WalletTopUp[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [methodFilter, setMethodFilter] = useState("");
  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createDraft, setCreateDraft] = useState({ email: "", amount: "", note: "" });
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState("");
  const [actionLoadingStatus, setActionLoadingStatus] = useState<"" | "APPROVED" | "REJECTED">("");
  const [loading, setLoading] = useState(false);
  const { t, tStatus } = useI18n();
  const { can } = usePermissions();
  const { selectedBranchId } = useBranch();
  const canManageWallet = can("wallet:manage");
  const canCreateTopups = can("wallet:topups:create");
  const canViewTopups = can("wallet:topups:view") || canManageWallet;

  const toIso = (value?: Date | null) => {
    if (!value) return undefined;
    if (Number.isNaN(value.getTime())) return undefined;
    return value.toISOString();
  };

  const getFilterParams = () => ({
    q: searchTerm.trim() || undefined,
    status: statusFilter || undefined,
    method: methodFilter || undefined,
    from: toIso(fromDate),
    to: toIso(toDate),
  });

  const load = async () => {
    if (!canViewTopups) return;
    setLoading(true);
    try {
      const data = await fetchTopUps(getFilterParams());
      setTopups(data);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (!selectedBranchId) return;
    load();
  }, [canViewTopups, selectedBranchId]);

  const submitCreate = async () => {
    if (!canCreateTopups) return;
    const amountValue = Number(createDraft.amount);
    if (!createDraft.email.trim() || !amountValue || amountValue <= 0) {
      setCreateError(t("invalidForm"));
      return;
    }
    setCreateSaving(true);
    setCreateError("");
    try {
      await createTopUpRequestAdmin({
        email: createDraft.email.trim(),
        amount: amountValue,
        method: "CASH_STORE",
        note: createDraft.note.trim() || undefined,
      });
      setShowCreateModal(false);
      setCreateDraft({ email: "", amount: "", note: "" });
      load();
    } catch (err: any) {
      const message = err?.response?.data?.message || "Failed to create request";
      setCreateError(message);
    } finally {
      setCreateSaving(false);
    }
  };

  const handleUpdateTopUp = async (id: string, status: "APPROVED" | "REJECTED") => {
    if (!canManageWallet) return;
    setActionLoadingId(id);
    setActionLoadingStatus(status);
    try {
      await updateTopUp(id, status);
      load();
    } finally {
      setActionLoadingId("");
      setActionLoadingStatus("");
    }
  };

  return (
    <>
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
              <option value="CASH_STORE">{t("wallet.methodStore")}</option>
              <option value="SHAM_CASH">{t("wallet.methodShamCash")}</option>
              <option value="BANK_TRANSFER">{t("wallet.methodBankTransfer")}</option>
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
                setFromDate(null);
                setToDate(null);
                load();
              }}
            >
              {t("clear")}
            </button>

          </div>

          {canCreateTopups && (
            <button className="primary" type="button" onClick={() => setShowCreateModal(true)}>
              {t("topUpRequest") || "Top-up request"}
            </button>
          )}
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>{t("customer")}</th>
              <th>{t("amount")}</th>
              <th>{t("method")}</th>
              <th>{t("orders.dateTime")}</th>
              <th>{t("status")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, idx) => (
                <tr key={`skeleton-${idx}`} className="productRow">
                  <td><span className="skeleton-line w-180" /></td>
                  <td><span className="skeleton-line w-80" /></td>
                  <td><span className="skeleton-line w-120" /></td>
                  <td><span className="skeleton-line w-140" /></td>
                  <td><span className="skeleton-line w-80" /></td>
                  <td><span className="skeleton-line w-120" /></td>
                </tr>
              ))
            ) : topups.length == 0 ? (
              <tr>
                <td colSpan={6} className="muted">{t("noTopups")}</td>
              </tr>
            ) : (
              topups.map((topup) => {
                const rowLoading = actionLoadingId === topup._id;
                const approveLoading = rowLoading && actionLoadingStatus === "APPROVED";
                const rejectLoading = rowLoading && actionLoadingStatus === "REJECTED";
                const customerLabel =
                  typeof topup.user === "string"
                    ? topup.user
                    : topup.user?.email || t("unknownUser") || "Unknown user";
                return (
                  <tr key={topup._id}>
                    <td>{customerLabel}</td>
                    <td>{topup.amount.toLocaleString()}</td>
                    <td>{topup.method}</td>
                    <td>{topup.createdAt ? new Date(topup.createdAt).toLocaleString() : "-"}</td>
                    <td>
                      <StatusPill value={topup.status} />
                    </td>
                    <td>
                      {canManageWallet && topup.status === "PENDING" && (
                        <>
                          <button
                            className="ghost-btn mr-10"
                            onClick={() => handleUpdateTopUp(topup._id, "APPROVED")}
                            disabled={rowLoading}
                          >
                            {approveLoading ? <div className="spinner small"></div> : t("approve")}
                          </button>
                          <button
                            className="ghost-btn danger"
                            onClick={() => handleUpdateTopUp(topup._id, "REJECTED")}
                            disabled={rowLoading}
                          >
                            {rejectLoading ? <div className="spinner small"></div> : t("reject")}
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </Card>

      {showCreateModal && canCreateTopups && (
        <div className="modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{t("topUpRequest") || "Top-up request"}</div>
              <button className="ghost-btn" type="button" onClick={() => setShowCreateModal(false)}>
                {t("close")}
              </button>
            </div>
            <div className="form">
              <label>
                {t("email")}
                <input
                  value={createDraft.email}
                  onChange={(e) => setCreateDraft({ ...createDraft, email: e.target.value })}
                />
              </label>
              <label>
                {t("amount")}
                <input
                  type="number"
                  value={createDraft.amount}
                  onChange={(e) => setCreateDraft({ ...createDraft, amount: e.target.value })}
                />
              </label>
              {/* <label>
                {t("method")}
                <input value={`${t("method")} (store)`} readOnly />
              </label> */}
              <label>
                {t("note")}
                <input
                  value={createDraft.note}
                  onChange={(e) => setCreateDraft({ ...createDraft, note: e.target.value })}
                />
              </label>
              {createError && <div className="error">{createError}</div>}
            </div>
            <div className="modal-actions">
              <button className="ghost-btn" type="button" onClick={() => setShowCreateModal(false)} disabled={createSaving}>
                {t("cancel")}
              </button>
              <button className="primary" type="button" onClick={submitCreate} disabled={createSaving}>
                {createSaving ? (t("saving") || "Saving...") : (t("save") || "Save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default WalletPage;
