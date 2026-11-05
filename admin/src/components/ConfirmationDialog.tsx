import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ModalContent } from "./ModalSurface";
import { registerConfirmationHost, type ConfirmationRequest } from "../utils/confirmation";
import { useI18n } from "../context/I18nContext";

export default function ConfirmationDialog() {
  const [requests, setRequests] = useState<ConfirmationRequest[]>([]);
  const pending = useRef(requests); pending.current = requests;
  const dialog = useRef<HTMLDialogElement>(null);
  const { lang } = useI18n();
  const request = requests[0];
  useEffect(() => {
    const unregister = registerConfirmationHost(value => {
      pending.current = [...pending.current, value];
      setRequests(pending.current);
    });
    return () => { unregister(); pending.current.forEach(value => value.resolve(false)); pending.current = []; };
  }, []);
  useEffect(() => { if (request && !dialog.current?.open) dialog.current?.showModal(); }, [request]);
  const finish = (confirmed: boolean) => {
    if (!request || pending.current[0] !== request) return;
    request.resolve(confirmed);
    pending.current = pending.current.slice(1);
    setRequests(pending.current);
  };
  if (!request) return null;
  return createPortal(<dialog ref={dialog} className="confirmation-dialog" dir={lang === "ar" ? "rtl" : "ltr"}
    aria-labelledby="confirmation-title" aria-describedby="confirmation-message"
    onCancel={event => { event.preventDefault(); finish(false); }}
    onClick={event => {
      if (event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) finish(false);
    }}>
    <ModalContent>
      <div className="modal-header"><h2 className="modal-title" id="confirmation-title">{request.title}</h2></div>
      <p className="confirmation-message" id="confirmation-message">{request.message}</p>
      <div className="modal-actions">
        {request.cancelLabel && <button className="ghost-btn" type="button" autoFocus onClick={() => finish(false)}>{request.cancelLabel}</button>}
        <button className={`primary${request.danger ? " danger" : ""}`} type="button" onClick={() => finish(true)}>{request.confirmLabel}</button>
      </div>
    </ModalContent>
  </dialog>, document.body);
}
