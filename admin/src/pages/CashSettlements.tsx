import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import api from "../api/client";
import Card from "../components/Card";
import { ModalContent } from "../components/ModalSurface";
import { useBranch } from "../context/BranchContext";
import { useI18n } from "../context/I18nContext";
import { usePermissions } from "../hooks/usePermissions";
import { confirmAction } from "../utils/confirmation";

type Currency = { _id: string; symbol: { en: string; ar?: string } };
type CashOrder = { _id: string; driverId: string; total: number; currency: Currency; customerName: string; deliveredAt: string };
type Receipt = { _id: string; driverId: string; amount: number; currency: Currency; actor: { name: string } | null; at: string; note?: string };
type Data = { branchId: string; drivers: { _id: string; name: string; email?: string; phone?: string }[]; orders: CashOrder[]; recent: Receipt[] };

function DriverOrdersDialog({ title, busy, onClose, children, actions }: {
  title: string; busy: boolean; onClose: () => void; children: ReactNode; actions: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { t, dir } = useI18n();
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.showModal();
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);
  return createPortal(
    <dialog ref={dialog} className="order-details-dialog" dir={dir} aria-labelledby="driver-cash-orders-title"
      onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
      onClick={event => {
        if (busy || event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
      }}>
      <ModalContent>
        <div className="order-details-modal-header">
          <h2 id="driver-cash-orders-title">{title}</h2>
          <button type="button" className="ghost-btn" autoFocus disabled={busy} onClick={onClose}>{t("close")}</button>
        </div>
        <div className="order-details-modal-body">{children}</div>
        <div className="modal-actions">{actions}</div>
      </ModalContent>
    </dialog>, document.body,
  );
}

export default function CashSettlements() {
  const { t, lang } = useI18n();
  const { selectedBranchId } = useBranch();
  const { can } = usePermissions();
  const canSettle = can("cash-settlements:manage");
  const [data, setData] = useState<Data | null>(null);
  const [driverId, setDriverId] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const branchRef = useRef(selectedBranchId);
  branchRef.current = selectedBranchId;
  const load = useCallback(async () => {
    const branch = selectedBranchId;
    if (!branch) return;
    setLoading(true);
    try {
      const result = (await api.get<{ data: Data }>("/cash-settlements")).data.data;
      if (branchRef.current === branch && result.branchId === branch) {
        setData(result);
        setSelected(previous => previous.filter(id => result.orders.some(order => order._id === id)));
      }
    } catch (err: any) {
      if (branchRef.current === branch) setError(err?.response?.data?.message || t("cash.loadError"));
    } finally {
      if (branchRef.current === branch) setLoading(false);
    }
  }, [selectedBranchId, lang]);
  useEffect(() => {
    setData(null); setDriverId(""); setSelected([]); setError(""); setMessage(""); setNote("");
    void load();
  }, [load]);
  const current = data?.branchId === selectedBranchId ? data : null;
  const orders = current?.orders || [];
  const driverOrders = orders.filter(order => order.driverId === driverId);
  const driver = current?.drivers.find(item => item._id === driverId);
  const visibleDrivers = useMemo(() => (current?.drivers || []).filter(item =>
    `${item.name} ${item.email || ""} ${item.phone || ""}`.toLowerCase().includes(search.trim().toLowerCase())), [current, search]);
  const money = (amount: number, currency?: Currency) => `${amount.toLocaleString(lang === "ar" ? "ar-SY" : "en-US", { maximumFractionDigits: 2 })} ${currency?.symbol?.[lang] || currency?.symbol?.en || "—"}`;
  const totals = (items: CashOrder[]) => {
    const grouped = new Map<string, { amount: number; currency: Currency }>();
    for (const order of items) {
      const key = order.currency?._id || "unknown";
      const entry = grouped.get(key) || { amount: 0, currency: order.currency };
      entry.amount = Math.round((entry.amount + order.total) * 1e6) / 1e6;
      grouped.set(key, entry);
    }
    return [...grouped.values()].map(entry => money(entry.amount, entry.currency)).join(" · ") || "0";
  };
  const settle = async (items: CashOrder[]) => {
    if (!canSettle || busyRef.current || !items.length || !selectedBranchId) return;
    const branch = selectedBranchId;
    busyRef.current = true; setBusy(true); setError(""); setMessage("");
    try {
      const confirmed = await confirmAction({
        title: t("cash.receiveCash"),
        message: `${driver?.name || ""}\n${t("cash.orders")}: ${items.length}\n${t("cash.amount")}: ${totals(items)}\n\n${t("cash.confirmHint")}`,
        confirmLabel: t("cash.receiveCash"), cancelLabel: t("cancel")
      });
      if (!confirmed || branchRef.current !== branch) return;
      const requestId = crypto.randomUUID();
      let settled = 0; let skipped = 0;
      for (let offset = 0; offset < items.length; offset += 1000) {
        if (branchRef.current !== branch) break;
        const result = (await api.post<{ data: { settledIds: string[]; skippedIds: string[] } }>("/cash-settlements", {
          branchId: branch, driverId, requestId, note,
          orders: items.slice(offset, offset + 1000).map(order => ({ orderId: order._id, expectedTotal: order.total, currencyId: order.currency?._id })),
        })).data.data;
        settled += result.settledIds.length; skipped += result.skippedIds.length;
      }
      if (branchRef.current === branch) {
        setMessage(`${t("cash.settled")}: ${settled}.${skipped ? ` ${t("cash.skipped")}: ${skipped}. ${t("cash.reviewChanges")}` : ""}`);
        setSelected([]); setNote("");
      }
    } catch (err: any) {
      if (branchRef.current === branch) setError(err?.response?.data?.message || t("cash.saveError"));
    } finally {
      if (branchRef.current === branch) await load();
      busyRef.current = false; setBusy(false);
    }
  };

  const closeDriver = () => {
    if (busyRef.current) return;
    setDriverId(""); setSelected([]); setNote("");
  };
  const selectedOrders = driverOrders.filter(order => selected.includes(order._id));
  const renderSkeletonRows = (columns: number) => Array.from({ length: 6 }, (_, index) => (
    <tr key={`skeleton-${index}`} className="productRow">
      {Array.from({ length: columns }, (_, column) => <td key={column}><span className={`skeleton-line ${column === 0 ? "w-140" : "w-80"}`} /></td>)}
    </tr>
  ));

  return <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
    <Card title={t("nav.cashSettlements")} subTitle={`(${visibleDrivers.length})`}>
      <div className="page-header">
        <form className="filters" onSubmit={event => event.preventDefault()}>
          <input className="filter-input" aria-label={t("cash.searchDrivers")} placeholder={t("cash.searchDrivers")} value={search} onChange={event => setSearch(event.target.value)} />
          <button className="ghost-btn" type="button" onClick={() => setSearch("")}>{t("clear")}</button>
        </form>
        <button type="button" className="primary" disabled={busy || loading} onClick={() => { setError(""); void load(); }}>
          {loading ? <div className="spinner small" /> : t("cash.refresh")}
        </button>
      </div>
      {!driver && error && <div className="error" role="alert">{error}</div>}
      {!driver && message && <p role="status">{message}</p>}
      <table className="table">
        <thead><tr>
          <th>{t("driver")}</th><th>{t("email")}</th><th>{t("phone")}</th><th>{t("cash.unsettledOrders")}</th><th>{t("cash.outstanding")}</th><th />
        </tr></thead>
        <tbody>
          {loading && !current ? renderSkeletonRows(6) : visibleDrivers.length ? visibleDrivers.map(item => {
            const outstanding = orders.filter(order => order.driverId === item._id);
            return <tr key={item._id}>
              <td>{item.name}</td><td>{item.email || "-"}</td><td>{item.phone || "-"}</td>
              <td>{outstanding.length}</td><td>{totals(outstanding)}</td>
              <td><button className="primary" type="button" disabled={busy || loading} onClick={() => {
                setDriverId(item._id); setSelected([]); setNote(""); setError(""); setMessage("");
              }}>{t("view")}</button></td>
            </tr>;
          }) : <tr><td colSpan={6} className="muted">{t("noResults")}</td></tr>}
        </tbody>
      </table>
    </Card>
    <Card title={t("cash.recent")} subTitle={`(${current?.recent.length || 0})`}>
      <table className="table">
        <thead><tr><th>{t("cash.order")}</th><th>{t("driver")}</th><th>{t("cash.amount")}</th><th>{t("cash.receivedBy")}</th><th>{t("cash.receivedAt")}</th><th>{t("note")}</th></tr></thead>
        <tbody>{loading && !current ? renderSkeletonRows(6) : current?.recent.length ? current.recent.map(receipt => <tr key={receipt._id}>
          <td>#{receipt._id.slice(-6).toUpperCase()}</td><td>{current.drivers.find(item => item._id === receipt.driverId)?.name || receipt.driverId}</td>
          <td>{money(receipt.amount, receipt.currency)}</td><td>{receipt.actor?.name || "-"}</td><td>{new Date(receipt.at).toLocaleString(lang)}</td><td>{receipt.note || "-"}</td>
        </tr>) : <tr><td colSpan={6} className="muted">{t("noResults")}</td></tr>}</tbody>
      </table>
    </Card>

    {driver && <DriverOrdersDialog
      title={`${driver.name} - ${t("cash.unsettledOrders")}`} busy={busy} onClose={closeDriver}
      actions={<>
        {canSettle && driverOrders.length > 0 && <>
          <button className="primary" type="button" disabled={busy || loading || !selectedOrders.length} onClick={() => void settle(selectedOrders)}>
            {t("cash.settleSelected")} ({selectedOrders.length})
          </button>
          <button className="ghost-btn" type="button" disabled={busy || loading} onClick={() => void settle(driverOrders)}>{t("cash.settleAll")}</button>
        </>}
        <button className="ghost-btn" type="button" disabled={busy} onClick={closeDriver}>{t("close")}</button>
      </>}>
      <div className="detail-grid order-overview">
        <div className="stat"><div className="stat-label">{t("cash.unsettledOrders")}</div><div className="stat-value">{driverOrders.length}</div></div>
        <div className="stat"><div className="stat-label">{t("cash.outstanding")}</div><div className="stat-value">{totals(driverOrders)}</div></div>
        {canSettle && <div className="stat"><div className="stat-label">{t("selected")}</div><div className="stat-value">{totals(selectedOrders)}</div></div>}
      </div>
      {error && <div className="error" role="alert">{error}</div>}
      {message && <p role="status">{message}</p>}
      <table className="table">
        <thead><tr>
          {canSettle && <th><div className="checkboxContainer">
            <input id="cash-select-all" type="checkbox" aria-label={t("selectAll")} disabled={busy || loading || !driverOrders.length} checked={driverOrders.length > 0 && driverOrders.every(order => selected.includes(order._id))} onChange={event => setSelected(event.target.checked ? driverOrders.map(order => order._id) : [])} />
            <label htmlFor="cash-select-all" />
          </div></th>}
          <th>{t("cash.order")}</th><th>{t("customer")}</th><th>{t("cash.deliveredAt")}</th><th>{t("cash.amount")}</th>{canSettle && <th />}
        </tr></thead>
        <tbody>{driverOrders.length ? driverOrders.map(order => <tr key={order._id}>
          {canSettle && <td><div className="checkboxContainer">
            <input id={`cash-order-${order._id}`} type="checkbox" aria-label={`${t("cash.order")} ${order._id.slice(-6)}`} disabled={busy || loading} checked={selected.includes(order._id)} onChange={event => setSelected(previous => event.target.checked ? [...previous, order._id] : previous.filter(id => id !== order._id))} />
            <label htmlFor={`cash-order-${order._id}`} />
          </div></td>}
          <td>#{order._id.slice(-6).toUpperCase()}</td><td>{order.customerName || "-"}</td><td>{new Date(order.deliveredAt).toLocaleString(lang)}</td><td>{money(order.total, order.currency)}</td>
          {canSettle && <td><button className="primary" type="button" disabled={busy || loading || !order.currency} onClick={() => void settle([order])}>{t("cash.receiveCash")}</button></td>}
        </tr>) : <tr><td colSpan={canSettle ? 6 : 4} className="muted">{t("cash.noOutstanding")}</td></tr>}</tbody>
      </table>
      {canSettle && driverOrders.length > 0 && <div className="form">
        <label>
          {t("cash.note")}
          <input maxLength={500} value={note} disabled={busy} onChange={event => setNote(event.target.value)} /></label>
      </div>}
    </DriverOrdersDialog>}
  </div>;
}
