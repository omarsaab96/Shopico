import { useEffect, useState } from "react";
import Card from "./Card";
import type { Currency, Order, Product } from "../types/api";
import { fetchOrderById, previewOrderItemRefund, refundOrderItem, type ItemRefundPreview } from "../api/client";
import { useI18n } from "../context/I18nContext";

type Props = {
  order: Order;
  canRefund: boolean;
  onChange: (order: Order) => void;
  formatMoney: (amount: number) => string;
  currencySymbol: (currency?: Currency | string) => string;
};

export default function OrderItems({ order, canRefund, onChange, formatMoney, currencySymbol }: Props) {
  const { t } = useI18n();
  const [editor, setEditor] = useState<{ itemIndex: number; quantity: number; requestId: string } | null>(null);
  const [preview, setPreview] = useState<ItemRefundPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const hasPendingRefund = order.refunds?.some(refund => refund.settlementStatus === "PENDING") || false;
  useEffect(() => {
    if (!hasPendingRefund || busy) return;
    let cancelled = false;
    const timer = setInterval(async () => {
      try {
        const refreshed = await fetchOrderById(order._id);
        if (!cancelled) onChange(refreshed);
      } catch { /* Recovery continues on the server if connectivity is lost. */ }
    }, 5000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [hasPendingRefund, busy, order._id, onChange]);
  const name = (product: Product | string | null | undefined) => typeof product === "object" ? product?.name || t("orders.unknownProduct") : product || t("orders.unknownProduct");
  const eligible = canRefund && ["PENDING", "PROCESSING"].includes(order.status);
  const selectedItem = editor ? order.items[editor.itemIndex] : null;
  const rawMoney = (amount: number, currency?: Currency | string) => `${amount.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${currencySymbol(currency)}`;

  const submit = async () => {
    if (!editor || busy) return;
    setBusy(true);
    setError("");
    try {
      if (!preview) {
        setPreview(await previewOrderItemRefund(order._id, editor.itemIndex, editor.quantity));
      } else {
        const updated = await refundOrderItem(order._id, {
          ...editor, expectedTotal: preview.expectedTotal, expectedRefundedQuantity: preview.expectedRefundedQuantity,
          expectedPaymentStatus: preview.expectedPaymentStatus, expectedAmount: preview.amount, expectedWalletAmount: preview.walletAmount,
          expectedCancelOrder: preview.cancelOrder,
        });
        onChange(updated);
        setEditor(null);
        setPreview(null);
        setSuccess(true);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || t("orders.refundFailed"));
      if (err?.response?.status === 409) {
        setPreview(null);
        setEditor(current => current ? { ...current, requestId: crypto.randomUUID() } : null);
        try { onChange(await fetchOrderById(order._id)); } catch { /* Keep the error visible so staff can retry. */ }
      }
    } finally { setBusy(false); }
  };

  return (
    <Card title={t("orders.items")} subTitle={`(${order.items.length})`}>
      <table className="table">
        <thead><tr><th>{t("name")}</th><th>{t("price")}</th><th>{t("orders.remainingOriginalQuantity")}</th><th>{t("orders.refundedQuantity")}</th><th>{t("total")}</th>{eligible && <th />}</tr></thead>
        <tbody>{order.items.map((item, index) => {
          const remaining = item.quantity - (item.refundedQuantity || 0);
          return <tr key={index}>
            <td>{name(item.product)}</td><td>{formatMoney(item.price)}</td><td>{remaining} / {item.quantity}</td>
            <td>{item.refundedQuantity || 0}</td><td>{formatMoney(item.price * remaining)}</td>
            {eligible && <td><button type="button" className="ghost-btn" disabled={busy || remaining <= 0} onClick={() => { setEditor({ itemIndex: index, quantity: 1, requestId: crypto.randomUUID() }); setPreview(null); setError(""); setSuccess(false); }}>{t("orders.refundItem")}</button></td>}
          </tr>;
        })}</tbody>
      </table>
      {success && <p className="success" role="status">{t(order.refunds?.some(refund => refund.settlementStatus === "PENDING") ? "orders.refundPending" : "orders.refundSuccess")}</p>}
      {!success && order.refunds?.some(refund => refund.settlementStatus === "PENDING") && <p role="status">{t("orders.refundPending")}</p>}
      {editor && selectedItem && <div className="order-refund-editor">
        <h4>{t("orders.refundItem")}: {name(selectedItem.product)}</h4>
        <p className="muted">{t("orders.refundExplanation")}</p>
        <label>{t("orders.refundQuantity")}<input type="number" min={1} max={selectedItem.quantity - (selectedItem.refundedQuantity || 0)} step={1} value={editor.quantity} disabled={busy} onChange={event => { setEditor({ ...editor, quantity: Number(event.target.value), requestId: crypto.randomUUID() }); setPreview(null); }} /></label>
        {preview && <div className="order-refund-preview">
          <div>{t("orders.refundAmount")}: <strong>{formatMoney(preview.amount)}</strong></div>
          {preview.cancelOrder ? <div role="status"><strong>{t("orders.refundCancelsOrder")}</strong></div> : <div>{t("orders.newTotal")}: <strong>{formatMoney(preview.newTotal)}</strong></div>}
          <div>{preview.creditWallet ? t("orders.walletCredit") : t("orders.unpaidReduction")}{preview.creditWallet && <>: <strong>{rawMoney(preview.walletAmount, preview.currency)}</strong></>}</div>
        </div>}
        {error && <p className="error" role="alert">{error}</p>}
        <div className="flex">
          <button type="button" className="primary" disabled={busy || !Number.isInteger(editor.quantity) || editor.quantity <= 0 || editor.quantity > selectedItem.quantity - (selectedItem.refundedQuantity || 0)} onClick={submit}>{busy ? t("saving") : preview ? t(preview.cancelOrder ? "orders.confirmRefundAndCancel" : "orders.confirmRefund") : t("orders.previewRefund")}</button>
          <button type="button" className="ghost-btn" disabled={busy} onClick={() => { setEditor(null); setPreview(null); }}>{t("cancel")}</button>
        </div>
      </div>}
      {!!order.refunds?.length && <div className="order-refund-history">
        <h4>{t("orders.refundHistory")}</h4>
        {order.refunds.map(refund => <div className="order-refund-history-row" key={refund.requestId}>
          <span>{name(order.items[refund.itemIndex]?.product)} × {refund.quantity}</span>
          <span>{formatMoney(refund.amount)}</span>
          <span>{refund.disposition === "WALLET" ? `${t("orders.walletCredit")}: ${rawMoney(refund.walletAmount, refund.currency)}` : t("orders.unpaidReduction")}</span>
          <time dateTime={refund.at}>{new Date(refund.at).toLocaleString()}</time>
          {refund.settlementStatus === "PENDING" && <span>{t("orders.refundPending")}</span>}
        </div>)}
      </div>}
    </Card>
  );
}
