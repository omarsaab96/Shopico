import { useEffect, useState } from "react";
import Card from "../components/Card";
import api from "../api/client";
import type { ApiUser } from "../types/api";
import { useI18n } from "../context/I18nContext";

interface UserDetails {
  user: ApiUser;
  wallet?: { balance: number };
  walletTx: { amount: number; type: string; source: string; createdAt: string }[];
  pointTx: { points: number; type: string; createdAt: string }[];
}

const UsersPage = () => {
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [selected, setSelected] = useState<UserDetails | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const { t } = useI18n();

  const getFilterParams = () => ({
    q: searchTerm.trim() || undefined,
    role: roleFilter || undefined,
  });

  const loadUsers = () => {
    api.get<{ data: ApiUser[] }>("/users", { params: getFilterParams() }).then((res) => setUsers(res.data.data));
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const loadDetails = async (id: string) => {
    const res = await api.get<{ data: UserDetails }>(`/users/${id}`);
    setSelected(res.data.data);
  };

  return (
    <div className="grid">
      <Card title={t("titles.users")}  subTitle={`(${users.length})`}>
        <div className="page-header" style={{ padding: 0, marginBottom: 12 }}>
          <div className="filters">
            <input
              className="filter-input"
              placeholder={t("searchNameEmail")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <select className="filter-select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="">{t("role")}</option>
              <option value="customer">{t("role.customer")}</option>
              <option value="admin">{t("role.admin")}</option>
              <option value="staff">{t("role.staff")}</option>
            </select>
            <button className="ghost-btn" type="button" onClick={loadUsers}>
              {t("filter")}
            </button>
            <button
              className="ghost-btn"
              type="button"
              onClick={() => {
                setSearchTerm("");
                setRoleFilter("");
                api.get<{ data: ApiUser[] }>("/users").then((res) => setUsers(res.data.data));
              }}
            >
              {t("clear")}
            </button>
          </div>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>{t("name")}</th>
              <th>{t("email")}</th>
              <th>{t("role")}</th>
              <th>{t("membership")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u._id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>{t(`role.${u.role}`) || u.role}</td>
                <td>{u.membershipLevel}</td>
                <td>
                  <button className="ghost-btn" onClick={() => loadDetails(u._id)}>
                    {t("view")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {selected && (
        <Card title={t("titles.userDetail")} subTitle="">
          <div className="detail-grid">
            <div>
              <div className="muted">{t("walletBalance")}</div>
              <div className="stat-value">{selected.wallet?.balance?.toLocaleString() || 0} SYP</div>
            </div>
            <div>
              <div className="muted">{t("points")}</div>
              <div className="stat-value">{selected.user.points || 0}</div>
            </div>
          </div>
          <div className="two-col">
            <div>
              <h4>{t("walletLedger")}</h4>
              <ul className="list">
                {selected.walletTx?.map((tx, idx) => (
                  <li key={idx}>
                    {tx.type} {tx.amount} ({tx.source})
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4>{t("pointsLedger")}</h4>
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
