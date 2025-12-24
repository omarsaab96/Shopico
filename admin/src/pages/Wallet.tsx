import { useEffect, useState } from "react";
import Card from "../components/Card";
import StatusPill from "../components/StatusPill";
import { fetchTopUps, updateTopUp } from "../api/client";
import type { WalletTopUp } from "../types/api";

const WalletPage = () => {
  const [topups, setTopups] = useState<WalletTopUp[]>([]);
  const load = () => fetchTopUps().then(setTopups);
  useEffect(() => {
    load();
  }, []);

  return (
    <Card title="Top-up approvals" subTitle={`(${topups.length})`}>
      <table className="table">
        <thead>
          <tr>
            <th>User</th>
            <th>Amount</th>
            <th>Method</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {topups.map((t) => (
            <tr key={t._id}>
              <td>{typeof t.user === "string" ? t.user : t.user.email}</td>
              <td>{t.amount.toLocaleString()}</td>
              <td>{t.method}</td>
              <td>
                <StatusPill value={t.status} />
              </td>
              <td>
                <button className="ghost-btn" onClick={() => updateTopUp(t._id, "APPROVED").then(load)}>
                  Approve
                </button>
                <button className="ghost-btn danger" onClick={() => updateTopUp(t._id, "REJECTED").then(load)}>
                  Reject
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
};

export default WalletPage;
