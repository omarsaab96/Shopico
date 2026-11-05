import { ModalContent } from "./ModalSurface";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import OrderDetailsPage from "../pages/OrderDetails";
import { useI18n } from "../context/I18nContext";

export default function OrderDetailsModal({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { t } = useI18n();

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.showModal();
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  return createPortal(
    <dialog
      ref={dialog}
      className="order-details-dialog"
      aria-labelledby="order-details-modal-title"
      onCancel={event => { event.preventDefault(); onClose(); }}
      onClick={event => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
      }}
    ><ModalContent>
      <div className="order-details-modal-header">
        <h2 id="order-details-modal-title">{t("orders.orderDetails")} #{orderId.slice(-6)}</h2>
        <button type="button" className="ghost-btn" autoFocus onClick={onClose}>{t("close")}</button>
      </div>
      <div className="order-details-modal-body">
        <OrderDetailsPage key={orderId} orderId={orderId} embedded />
      </div>
    </ModalContent></dialog>,
    document.body
  );
}
