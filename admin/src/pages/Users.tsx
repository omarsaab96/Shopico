import { useEffect, useState } from "react";
import Card from "../components/Card";
import api from "../api/client";
import type { ApiUser } from "../types/api";

interface UserDetails {
  user: ApiUser;
  wallet?: { balance: number };
  walletTx: { amount: number; type: string; source: string; createdAt: string }[];
  pointTx: { points: number; type: string; createdAt: string }[];
}

const UsersPage = () => {
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [selected, setSelected] = useState<UserDetails | null>(null);

  useEffect(() => {
    api.get<{ data: ApiUser[] }>("/users").then((res) => setUsers(res.data.data));
  }, []);

  const loadDetails = async (id: string) => {
    const res = await api.get<{ data: UserDetails }>(`/users/${id}`);
    setSelected(res.data.data);
  };

  return (
    <div className="grid">
      <Card title="Users"  subTitle={`(${users.length})`}>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Membership</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u._id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>{u.role}</td>
                <td>{u.membershipLevel}</td>
                <td>
                  <button className="ghost-btn" onClick={() => loadDetails(u._id)}>
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {selected && (
        <Card title="User Detail" subTitle="">
          <div className="detail-grid">
            <div>
              <div className="muted">Wallet Balance</div>
              <div className="stat-value">{selected.wallet?.balance?.toLocaleString() || 0} SYP</div>
            </div>
            <div>
              <div className="muted">Points</div>
              <div className="stat-value">{selected.user.points || 0}</div>
            </div>
          </div>
          <div className="two-col">
            <div>
              <h4>Wallet Ledger</h4>
              <ul className="list">
                {selected.walletTx?.map((tx, idx) => (
                  <li key={idx}>
                    {tx.type} {tx.amount} ({tx.source})
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4>Points Ledger</h4>
              <ul className="list">
                {selected.pointTx?.map((tx, idx) => (
                  <li key={idx}>
                    {tx.type} {tx.points} pts
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default UsersPage;
