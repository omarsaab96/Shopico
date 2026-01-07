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
  addresses: { _id: string; label: string; address: string; phone?: string }[];
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

  const closeDetails = () => {
    setSelected(null);
  };

  const formatDateTime = (dateTime: string): string => {
    if (!dateTime) return "";

    const date = new Date(dateTime);
    if (isNaN(date.getTime())) return "";

    const pad = (n: number) => String(n).padStart(2, "0");

    return (
      `${pad(date.getDate())}-` +
      `${pad(date.getMonth() + 1)}-` +
      `${date.getFullYear()} ` +
      `${pad(date.getHours())}:` +
      `${pad(date.getMinutes())}:` +
      `${pad(date.getSeconds())}`
    );
  };

  return (
    <div className="grid">
      <Card title={t("titles.users")} subTitle={`(${users.length})`}>
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
        <div className="modal-backdrop" onClick={closeDetails}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{t("titles.userDetail")}</div>
              <button className="ghost-btn" type="button" onClick={closeDetails}>
                {t("close")}
              </button>
            </div>

            <table className="detailsTable">
              <tr>
                <td>ID</td>
                <td>{selected.user._id}</td>
              </tr>
              <tr>
                <td>Name</td>
                <td>{selected.user.name}</td>
              </tr>
              <tr>
                <td>Email</td>
                <td>{selected.user.email}</td>
              </tr>
              <tr>
                <td>Membership Level</td>
                <td>{selected.user.membershipLevel}</td>
              </tr>
              <tr>
                <td>Phone</td>
                <td>{selected.user.phone?selected.user.phone:<div className="muted">{t("noPhone")}</div>}</td>
              </tr>
              <tr>
                <td>Role</td>
                <td>{selected.user.role}</td>
              </tr>
              <tr>
                <td>{t("addresses")}</td>
                <td>
                  {selected.addresses?.length ? (
                    <ul className="list">
                      {selected.addresses.map((addr) => (
                        <li key={addr._id}>
                          {addr.label}: {addr.address}
                          {addr.phone ? ` (${addr.phone})` : ""}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="muted">{t("noAddresses")}</div>
                  )}
                </td>
              </tr>
            </table>

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
                    <li key={idx} className="listCenterItems">
                      {tx.type === "CREDIT" ? (
                        <svg fill="#009933" xmlns="http://www.w3.org/2000/svg"
                          width="14" height="14" viewBox="0 0 52 52" enable-background="new 0 0 52 52">
                          <path d="M9.6,31c-0.8,0.8-0.8,1.9,0,2.7l15,14.7c0.8,0.8,2,0.8,2.8,0l15.1-14.7c0.8-0.8,0.8-1.9,0-2.7l-2.8-2.7
	c-0.8-0.8-2-0.8-2.8,0l-4.7,4.6C31.4,33.7,30,33.2,30,32V5c0-1-0.9-2-2-2h-4c-1.1,0-2,1.1-2,2v27c0,1.2-1.4,1.7-2.2,0.9l-4.7-4.6
	c-0.8-0.8-2-0.8-2.8,0L9.6,31z"/>
                        </svg>
                      ) : (
                        <svg fill="#ff0000" xmlns="http://www.w3.org/2000/svg"
                          width="14" height="14" viewBox="0 0 52 52" enable-background="new 0 0 52 52">
                          <path d="M41.4,21c0.8-0.8,0.8-1.9,0-2.7l-15-14.7c-0.8-0.8-2-0.8-2.8,0L8.6,18.3c-0.8,0.8-0.8,1.9,0,2.7l2.8,2.7
	c0.8,0.8,2,0.8,2.8,0l4.7-4.6c0.8-0.8,2.2-0.2,2.2,0.9v27c0,1,0.9,2,2,2h4c1.1,0,2-1.1,2-2V20c0-1.2,1.4-1.7,2.2-0.9l4.7,4.6
	c0.8,0.8,2,0.8,2.8,0L41.4,21z"/>
                        </svg>
                      )}
                      <span>{formatDateTime(tx.createdAt)}</span> {tx.amount} - {tx.source}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4>{t("pointsLedger")}</h4>
                <ul className="list">
                  {selected.pointTx?.map((tx, idx) => (
                    <li key={idx} className="listCenterItems">
                      {tx.type === "EARN" ? (
                        <svg fill="#009933" width="14" height="14" viewBox="-3 0 19 19" xmlns="http://www.w3.org/2000/svg"><path d="M12.711 9.182a1.03 1.03 0 0 1-1.03 1.03H7.53v4.152a1.03 1.03 0 0 1-2.058 0v-4.152H1.318a1.03 1.03 0 1 1 0-2.059h4.153V4.001a1.03 1.03 0 0 1 2.058 0v4.152h4.153a1.03 1.03 0 0 1 1.029 1.03z" /></svg>
                      ) : (
                        <svg fill="#ff0000" width="14" height="14" viewBox="0 0 24 24" version="1.2" baseProfile="tiny" xmlns="http://www.w3.org/2000/svg"><path d="M18 11h-12c-1.104 0-2 .896-2 2s.896 2 2 2h12c1.104 0 2-.896 2-2s-.896-2-2-2z" /></svg>
                      )}
                      <span>{formatDateTime(tx.createdAt)}</span> {tx.points} pts
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersPage;
