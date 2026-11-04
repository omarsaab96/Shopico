import { useEffect, useState } from "react";

export interface ToastItem {
  _id: string;
  title: { en: string; ar: string };
  body: { en: string; ar: string };
}

function Toast({ item, ar, onRead, onRemove }: {
  item: ToastItem;
  ar: boolean;
  onRead: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setLeaving(true), 8000);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => onRemove(item._id), 240);
    return () => window.clearTimeout(timer);
  }, [leaving, item._id, onRemove]);
  return <div className={`notification-toast-slot${leaving ? " leaving" : ""}`} inert={leaving}>
    <div className="notification-toast-clip">
      <div className="notification-toast">
        <button className="notification-item" onClick={() => onRead(item._id)}>
          <strong>{item.title[ar ? "ar" : "en"]}</strong>
          <span>{item.body[ar ? "ar" : "en"]}</span>
        </button>
        <button className="ghost-btn" type="button" onClick={() => setLeaving(true)} aria-label={ar ? "إغلاق" : "Dismiss"}>×</button>
      </div>
    </div>
  </div>;
}

export default function NotificationToasts({ items, ar, onRead, onRemove }: {
  items: ToastItem[];
  ar: boolean;
  onRead: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  return <div className="notification-toast-stack" dir={ar ? "rtl" : "ltr"} aria-live="polite" aria-relevant="additions">
    {items.map(item => <Toast key={item._id} item={item} ar={ar} onRead={onRead} onRemove={onRemove} />)}
  </div>;
}
