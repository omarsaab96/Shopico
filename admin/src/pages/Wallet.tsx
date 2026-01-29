import { useEffect, useState } from "react";
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
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createDraft, setCreateDraft] = useState({ email: "", amount: "", note: "" });
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState("");
  const [actionLoadingStatus, setActionLoadingStatus] = useState<"" | "APPROVED" | "REJECTED">("");
  const { t, tStatus } = useI18n();
  const { can } = usePermissions();
  const { selectedBranchId } = useBranch();
  const canManageWallet = can("wallet:manage");
  const canCreateTopups = can("wallet:topups:create");
  const canViewTopups = can("wallet:topups:view") || canManageWallet;

  const getFilterParams = () => ({
    q: searchTerm.trim() || undefined,
    status: statusFilter || undefined,
    method: methodFilter || undefined,
  });

  const load = () => {
    if (!canViewTopups) return;
    fetchTopUps(getFilterParams()).then(setTopups);
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
            {canCreateTopups && (
              <button className="primary" type="button" onClick={() => setShowCreateModal(true)}>
                {t("topUpRequest") || "Top-up request"}
              </button>
            )}
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
              topups.map((topup) => {
                const rowLoading = actionLoadingId === topup._id;
                const approveLoading = rowLoading && actionLoadingStatus === "APPROVED";
                const rejectLoading = rowLoading && actionLoadingStatus === "REJECTED";
                return (
                  <tr key={topup._id}>
                    <td>{typeof topup.user === "string" ? topup.user : topup.user.email}</td>
                    <td>{topup.amount.toLocaleString()}</td>
                    <td>{topup.method}</td>
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
