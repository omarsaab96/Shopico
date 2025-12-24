const colors: Record<string, string> = {
  PENDING: "var(--amber-500)",
  PROCESSING: "var(--blue-500)",
  SHIPPING: "var(--indigo-500)",
  DELIVERED: "var(--green-600)",
  CANCELLED: "var(--red-500)",
  APPROVED: "var(--green-600)",
  REJECTED: "var(--red-500)",
};

import { useI18n } from "../context/I18nContext";

const StatusPill = ({ value }: { value: string }) => {
  const { tStatus } = useI18n();
  const color = colors[value] || "var(--gray-600)";
  return (
    <span className="status-pill" style={{ background: color + "22", color }}>
      {tStatus(value)}
    </span>
  );
};

export default StatusPill;
