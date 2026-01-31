import { useEffect, useState } from "react";
import Card from "../components/Card";
import api, { adminTopUpUser, createUser, fetchBranches, updateUserBranches, updateUserPermissions } from "../api/client";
import type { ApiUser } from "../types/api";
import { useI18n } from "../context/I18nContext";
import { usePermissions } from "../hooks/usePermissions";
import { useAuth } from "../context/AuthContext";
import { PERMISSION_GROUPS } from "../constants/permissions";
import { useBranch } from "../context/BranchContext";

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
  const [loading, setLoading] = useState("");
  const [listLoading, setListLoading] = useState(false);
  const [topupAmount, setTopupAmount] = useState("");
  const [topupNote, setTopupNote] = useState("");
  const [topupLoading, setTopupLoading] = useState(false);
  const [topupError, setTopupError] = useState("");
  const [permissionsDraft, setPermissionsDraft] = useState<string[]>([]);
  const [permissionsSaving, setPermissionsSaving] = useState(false);
  const [permissionsError, setPermissionsError] = useState("");
  const [permissionsSuccess, setPermissionsSuccess] = useState("");
  const [branchDraft, setBranchDraft] = useState<string[]>([]);
  const [branchSaving, setBranchSaving] = useState(false);
  const [branchError, setBranchError] = useState("");
  const [branchSuccess, setBranchSuccess] = useState("");
  const [assignableBranches, setAssignableBranches] = useState<typeof branches>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createDraft, setCreateDraft] = useState({
    name: "",
    email: "",
    password: "",
    role: "staff",
    phone: "",
    permissions: [] as string[],
    branchIds: [] as string[],
  });
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const { t } = useI18n();
  const { can } = usePermissions();
  const { user: currentUser, refreshProfile } = useAuth();
  const { selectedBranchId, branches } = useBranch();
  const canManageUsers = can("users:manage");
  const canManageWallet = can("wallet:manage");
  const canAssignBranches = can("branches:assign");

  const getFilterParams = () => ({
    q: searchTerm.trim() || undefined,
    role: roleFilter || undefined,
  });

  const loadUsers = async () => {
    setListLoading(true);
    try {
      const res = await api.get<{ data: ApiUser[] }>("/users", { params: getFilterParams() });
      setUsers(res.data.data);
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedBranchId) return;
    loadUsers();
  }, [selectedBranchId]);

  useEffect(() => {
    if (!canAssignBranches) {
      setAssignableBranches(branches);
      return;
    }
    fetchBranches()
      .then(setAssignableBranches)
      .catch(() => setAssignableBranches(branches));
  }, [canAssignBranches, branches.length]);

  useEffect(() => {
    setTopupAmount("");
    setTopupNote("");
    setTopupError("");
    setTopupLoading(false);
    setPermissionsDraft(selected?.user?.permissions || []);
    setPermissionsError("");
    setPermissionsSuccess("");
    setPermissionsSaving(false);
    setBranchDraft(selected?.user?.branchIds || []);
    setBranchError("");
    setBranchSuccess("");
    setBranchSaving(false);
  }, [selected?.user?._id]);

  const fetchUserDetails = async (id: string) => {
    const res = await api.get<{ data: UserDetails }>(`/users/${id}`);
    return res.data.data;
  };

  const loadDetails = async (id: string) => {
    setLoading(id)
    const data = await fetchUserDetails(id);
    setSelected(data);
    setLoading("")
  };

  const closeDetails = () => {
    setSelected(null);
  };

  const openCreateModal = () => {
    if (!canManageUsers) return;
    setCreateDraft({
      name: "",
      email: "",
      password: "",
      role: "staff",
      phone: "",
      permissions: [],
      branchIds: selectedBranchId ? [selectedBranchId] : [],
    });
    setCreateError("");
    setCreateSaving(false);
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    if (createSaving) return;
    setShowCreateModal(false);
  };

  const toggleCreatePermission = (permission: string) => {
    setCreateDraft((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter((item) => item !== permission)
        : [...prev.permissions, permission],
    }));
  };

  const toggleCreateBranch = (branchId: string) => {
    setCreateDraft((prev) => ({
      ...prev,
      branchIds: prev.branchIds.includes(branchId)
        ? prev.branchIds.filter((item) => item !== branchId)
        : [...prev.branchIds, branchId],
    }));
  };

  const submitCreateUser = async () => {
    if (!canManageUsers) return;
    if (!createDraft.name.trim() || !createDraft.email.trim() || !createDraft.password.trim()) {
      setCreateError(t("invalidForm"));
      return;
    }
    setCreateSaving(true);
    setCreateError("");
    try {
      await createUser({
        name: createDraft.name.trim(),
        email: createDraft.email.trim(),
        password: createDraft.password,
        role: createDraft.role,
        phone: createDraft.phone.trim() || undefined,
        permissions: createDraft.permissions,
        branchIds: createDraft.branchIds.length ? createDraft.branchIds : undefined,
      });
      setShowCreateModal(false);
      loadUsers();
    } catch (err: any) {
      const message = err?.response?.data?.message || "Failed to create user";
      setCreateError(message);
    } finally {
      setCreateSaving(false);
    }
  };

  const handleTopUp = async () => {
    if (!selected) return;
    if (!canManageWallet) {
      setTopupError(t("noPermissionAction"));
      return;
    }
    const amountValue = Number(topupAmount);
    if (!amountValue || amountValue <= 0) {
      setTopupError(t("invalidAmount"));
      return;
    }
    setTopupLoading(true);
    setTopupError("");
    try {
      await adminTopUpUser(selected.user._id, amountValue, topupNote.trim() || undefined);
      const data = await fetchUserDetails(selected.user._id);
      setSelected(data);
      setTopupAmount("");
      setTopupNote("");
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || "Failed to top up wallet";
      setTopupError(message);
    } finally {
      setTopupLoading(false);
    }
  };

  const togglePermission = (permission: string) => {
    setPermissionsDraft((prev) =>
      prev.includes(permission) ? prev.filter((item) => item !== permission) : [...prev, permission]
    );
  };

  const savePermissions = async () => {
    if (!selected || !canManageUsers) return;
    setPermissionsSaving(true);
    setPermissionsError("");
    setPermissionsSuccess("");
    try {
      const updatedUser = await updateUserPermissions(selected.user._id, permissionsDraft);
      setSelected((prev) => (prev ? { ...prev, user: updatedUser } : prev));
      setPermissionsSuccess(t("permissionsUpdated"));
      if (updatedUser._id === currentUser?._id) {
        await refreshProfile();
      }
    } catch (err: any) {
      const message = err?.response?.data?.message || "Failed to update permissions";
      setPermissionsError(message);
    } finally {
      setPermissionsSaving(false);
    }
  };

  const saveBranches = async () => {
    if (!selected || !canAssignBranches) return;
    setBranchSaving(true);
    setBranchError("");
    setBranchSuccess("");
    try {
      const updatedUser = await updateUserBranches(selected.user._id, branchDraft);
      setSelected((prev) => (prev ? { ...prev, user: updatedUser } : prev));
      setBranchSuccess(t("branchesUpdated") || "Branches updated");
      if (updatedUser._id === currentUser?._id) {
        await refreshProfile();
      }
    } catch (err: any) {
      const message = err?.response?.data?.message || "Failed to update branches";
      setBranchError(message);
    } finally {
      setBranchSaving(false);
    }
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
              <option value="staff">{t("role.staff")}</option>
              <option value="manager">{t("role.manager")}</option>
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
                loadUsers();
              }}
            >
              {t("clear")}
            </button>
          </div>
          {canManageUsers && (
            <button className="primary" type="button" onClick={openCreateModal}>
              {t("addUser")}
            </button>
          )}
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
            {listLoading ? (
              Array.from({ length: 6 }).map((_, idx) => (
                <tr key={`skeleton-${idx}`} className="productRow">
                  <td><span className="skeleton-line w-140" /></td>
                  <td><span className="skeleton-line w-180" /></td>
                  <td><span className="skeleton-line w-100" /></td>
                  <td><span className="skeleton-line w-80" /></td>
                  <td><span className="skeleton-line w-80" /></td>
                </tr>
              ))
            ) : users.map((u) => (
              <tr key={u._id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>{t(`role.${u.role}`) || u.role}</td>
                <td>{u.membershipLevel}</td>
                <td>
                  <button className="ghost-btn" onClick={() => loadDetails(u._id)} disabled={loading == u._id}>
                    {loading == u._id ?
                      <div className="spinner small"></div>
                      : t("view")}
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
                <td>{selected.user.phone ? selected.user.phone : <div className="muted">{t("noPhone")}</div>}</td>
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

            {/* <div style={{ marginBottom: 12 }}>
              <h4>{t("topUpWallet")}</h4>
              <div className="form">
                <label>
                  {t("amount")}
                  <input
                    type="number"
                    min="1"
                    value={topupAmount}
                    onChange={(e) => setTopupAmount(e.target.value)}
                    placeholder="0"
                  />
                </label>
                <label>
                  {t("note")}
                  <input
                    value={topupNote}
                    onChange={(e) => setTopupNote(e.target.value)}
                    placeholder={t("note")}
                  />
                </label>
                {topupError && <div className="error">{topupError}</div>}
                <div className="modal-actions">
                  <button
                    className="ghost-btn"
                    type="button"
                    onClick={handleTopUp}
                    disabled={topupLoading || !canManageWallet}
                  >
                    {topupLoading ? t("saving") : t("topUp")}
                  </button>
                </div>
              </div>
            </div> */}

            <div style={{ marginBottom: 12 }}>
              <h4>{t("permissions")}</h4>
              <div className="permissions-grid">
                {PERMISSION_GROUPS.map((group) => (
                  <div className="permissions-group" key={group.key}>
                    <div className="permissions-title">{t(group.labelKey)}</div>
                    {group.permissions.map((permission) => (
                      <label className="permission-item" key={permission.key}>
                        <input
                          type="checkbox"
                          checked={permissionsDraft.includes(permission.key)}
                          onChange={() => togglePermission(permission.key)}
                          disabled={!canManageUsers}
                        />
                        <span>{t(permission.labelKey)}</span>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
              {permissionsError && <div className="error">{permissionsError}</div>}
              {permissionsSuccess && <div className="success">{permissionsSuccess}</div>}
              {canManageUsers && (
                <div className="modal-actions">
                  <button
                    className="ghost-btn"
                    type="button"
                    onClick={savePermissions}
                    disabled={permissionsSaving}
                  >
                    {permissionsSaving ? t("saving") : t("savePermissions")}
                  </button>
                </div>
              )}
            </div>

            <div style={{ marginBottom: 12 }}>
              <h4>{t("branches")}</h4>
              <div className="permissions-grid">
                {assignableBranches.length === 0 ? (
                  <div className="muted">{t("noBranches")}</div>
                ) : (
                  assignableBranches.map((branch) => (
                    <label className="permission-item" key={branch._id}>
                      <input
                        type="checkbox"
                        checked={branchDraft.includes(branch._id)}
                        onChange={() =>
                          setBranchDraft((prev) =>
                            prev.includes(branch._id)
                              ? prev.filter((item) => item !== branch._id)
                              : [...prev, branch._id]
                          )
                        }
                        disabled={!canAssignBranches}
                      />
                      <span>{branch.name}</span>
                    </label>
                  ))
                )}
              </div>
              {branchError && <div className="error">{branchError}</div>}
              {branchSuccess && <div className="success">{branchSuccess}</div>}
              {canAssignBranches && (
                <div className="modal-actions">
                  <button
                    className="ghost-btn"
                    type="button"
                    onClick={saveBranches}
                    disabled={branchSaving}
                  >
                    {branchSaving ? t("saving") : (t("saveBranches") || "Save branches")}
                  </button>
                </div>
              )}
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
      {showCreateModal && canManageUsers && (
        <div className="modal-backdrop" onClick={closeCreateModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{t("newUser")}</div>
              <button className="ghost-btn" type="button" onClick={closeCreateModal}>
                {t("close")}
              </button>
            </div>

            <div className="form">
              <label>
                {t("name")}
                <input value={createDraft.name} onChange={(e) => setCreateDraft({ ...createDraft, name: e.target.value })} />
              </label>
              <label>
                {t("email")}
                <input
                  type="email"
                  value={createDraft.email}
                  onChange={(e) => setCreateDraft({ ...createDraft, email: e.target.value })}
                />
              </label>
              <label>
                {t("passwordLabel")}
                <input
                  type="password"
                  value={createDraft.password}
                  onChange={(e) => setCreateDraft({ ...createDraft, password: e.target.value })}
                />
              </label>
              <label>
                {t("phone")}
                <input
                  value={createDraft.phone}
                  onChange={(e) => setCreateDraft({ ...createDraft, phone: e.target.value })}
                />
              </label>
              <label>
                {t("role")}
                <select value={createDraft.role} onChange={(e) => setCreateDraft({ ...createDraft, role: e.target.value })}>
                  <option value="customer">{t("role.customer")}</option>
                  <option value="staff">{t("role.staff")}</option>
                  <option value="manager">{t("role.manager")}</option>
                </select>
              </label>
            </div>

            <h4>{t("permissions")}</h4>
            <div className="permissions-grid">
              {PERMISSION_GROUPS.map((group) => (
                <div className="permissions-group" key={group.key}>
                  <div className="permissions-title">{t(group.labelKey)}</div>
                  {group.permissions.map((permission) => (
                    <label className="permission-item" key={permission.key}>
                      <input
                        type="checkbox"
                        checked={createDraft.permissions.includes(permission.key)}
                        onChange={() => toggleCreatePermission(permission.key)}
                      />
                      <span>{t(permission.labelKey)}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
            <h4>{t("branches")}</h4>
            <div className="permissions-grid">
              {assignableBranches.length === 0 ? (
                <div className="muted">{t("noBranches")}</div>
              ) : (
                assignableBranches.map((branch) => (
                  <label className="permission-item" key={branch._id}>
                    <input
                      type="checkbox"
                      checked={createDraft.branchIds.includes(branch._id)}
                      onChange={() => toggleCreateBranch(branch._id)}
                    />
                    <span>{branch.name}</span>
                  </label>
                ))
              )}
            </div>
            {createError && <div className="error">{createError}</div>}
            <div className="modal-actions">
              <button className="ghost-btn" type="button" onClick={closeCreateModal} disabled={createSaving}>
                {t("cancel")}
              </button>
              <button className="primary" type="button" onClick={submitCreateUser} disabled={createSaving}>
                {createSaving ? t("saving") : t("createUser")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersPage;
