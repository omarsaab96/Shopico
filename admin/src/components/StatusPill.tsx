const colors: Record<string, string> = {
  PENDING: "var(--amber-500)",
  PROCESSING: "var(--blue-500)",
  SHIPPING: "var(--indigo-500)",
  DELIVERED: "var(--green-600)",
  CANCELLED: "var(--red-500)",
  APPROVED: "var(--green-600)",
  REJECTED: "var(--red-500)",
};

const StatusPill = ({ value }: { value: string }) => {
  const color = colors[value] || "var(--gray-600)";
  return (
    <span className="status-pill" style={{ background: color + "22", color }}>
      {value}
    </span>
  );
};

export default StatusPill;
