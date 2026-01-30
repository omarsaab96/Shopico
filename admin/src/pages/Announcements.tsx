import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Card from "../components/Card";
import type { Announcement, AnnouncementImage } from "../types/api";
import { deleteAnnouncement, fetchAnnouncements, getImageKitAuth, saveAnnouncement } from "../api/client";
import { useI18n } from "../context/I18nContext";
import { usePermissions } from "../hooks/usePermissions";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { useBranch } from "../context/BranchContext";

const uploadUrl = import.meta.env.VITE_IMAGEKIT_UPLOAD_URL;

type AnnouncementDraft = Omit<Announcement, "startsAt" | "endsAt"> & {
  startsAt?: Date | string;
  endsAt?: Date | string;
};

const toIso = (value?: Date | string | null) => {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
};

const getDefaultDates = () => {
  const now = new Date();
  const end = new Date();
  end.setDate(end.getDate() + 30);
  return {
    startsAt: now,
    endsAt: end,
  };
};

const toDate = (value?: Date | string) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const AnnouncementsPage = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [draft, setDraft] = useState<AnnouncementDraft>({});
  const [showNewModal, setShowNewModal] = useState(false);
  const [uploadingNew, setUploadingNew] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterFrom, setFilterFrom] = useState<Date | null>(null);
  const [filterTo, setFilterTo] = useState<Date | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<AnnouncementDraft>({});
  const [editUploadingId, setEditUploadingId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const [editError, setEditError] = useState("");
  const { t } = useI18n();
  const { can } = usePermissions();
  const { selectedBranchId } = useBranch();
  const canManage = can("announcements:manage");
  const canUpload = can("uploads:auth") && canManage;

  const getFilterParams = () => ({
    q: searchTerm.trim() || undefined,
    from: toIso(filterFrom),
    to: toIso(filterTo),
  });

  const load = (params?: { q?: string; from?: string; to?: string }) =>
    fetchAnnouncements(params).then(setAnnouncements).catch(console.error);

  useEffect(() => {
    if (!selectedBranchId) return;
    load(getFilterParams());
  }, [selectedBranchId]);

  const applyFilters = () => {
    load(getFilterParams());
  };

  const resetFilters = () => {
    setSearchTerm("");
    setFilterFrom(null);
    setFilterTo(null);
    load();
  };

  const openNewModal = () => {
    if (!canManage) return;
    const defaults = getDefaultDates();
    setDraft({ ...defaults, isEnabled: true });
    setFormError("");
    setShowNewModal(true);
  };

  const closeNewModal = () => setShowNewModal(false);

  const uploadToImageKit = async (
    file: File,
    onDone: (img: AnnouncementImage) => void,
    setUploading: (v: boolean) => void,
    onError: (msg: string) => void
  ) => {
    setUploading(true);
    try {
      const auth = await getImageKitAuth();
      const publicKey = auth.publicKey || import.meta.env.VITE_IMAGEKIT_PUBLIC_KEY;
      const form = new FormData();
      form.append("file", file);
      form.append("fileName", file.name);
      form.append("token", auth.token);
      form.append("signature", auth.signature);
      form.append("expire", String(auth.expire));
      if (publicKey) form.append("publicKey", publicKey);
      const res = await fetch(uploadUrl, { method: "POST", body: form });
      const data = (await res.json()) as { url?: string; fileId?: string; message?: string };
      if (!res.ok || !data?.url || !data?.fileId) {
        const msg = data?.message || "Upload failed";
        throw new Error(msg);
      }
      onDone({ url: data.url, fileId: data.fileId });
    } catch (err: any) {
      const message = err?.message || "Image upload failed";
      onError(message);
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canManage) return;
    try {
      const payload = {
        ...draft,
        startsAt: toIso(draft.startsAt),
        endsAt: toIso(draft.endsAt),
      };
      const saved = await saveAnnouncement(payload);
      setAnnouncements((prev) => [saved, ...prev]);
      setDraft({});
      setFormError("");
      setShowNewModal(false);
      load();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Create failed";
      setFormError(msg);
    }
  };

  const startEdit = (announcement: Announcement) => {
    if (!canManage) return;
    setEditingId(announcement._id);
    setEditDraft({
      ...announcement,
      startsAt: announcement.startsAt,
      endsAt: announcement.endsAt,
    });
    setEditError("");
  };

  const saveEdit = async () => {
    if (!editingId) return;
    if (!canManage) return;
    try {
      const payload = {
        ...editDraft,
        _id: editingId,
        startsAt: toIso(editDraft.startsAt),
        endsAt: toIso(editDraft.endsAt),
      };
      const saved = await saveAnnouncement(payload);
      setAnnouncements((prev) => prev.map((p) => (p._id === saved._id ? saved : p)));
      setEditingId(null);
      setEditDraft({});
      load();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Update failed";
      setEditError(msg);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft({});
    setEditError("");
  };

  const removeNewImage = () => setDraft((prev) => ({ ...prev, image: undefined }));
  const removeEditImage = () => setEditDraft((prev) => ({ ...prev, image: undefined }));

  return (
    <>
      <Card title={t("nav.announcements") || "Announcements"} subTitle={`(${announcements.length})`}>
        <div className="page-header">
          <div className="filters">
            <input
              className="filter-input"
              placeholder={t("searchAnnouncements") || "Search announcements"}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <DatePicker
              className="filter-input date-picker"
              selected={filterFrom}
              onChange={(date) => setFilterFrom(date)}
              placeholderText={t("from") || "From"}
              showTimeInput
              timeFormat="HH:mm"
              timeIntervals={15}
              dateFormat="MM/dd/yyyy h:mm aa"
              isClearable
            />
            <DatePicker
              className="filter-input date-picker"
              selected={filterTo}
              onChange={(date) => setFilterTo(date)}
              placeholderText={t("till") || "Till"}
              showTimeInput
              timeFormat="HH:mm"
              timeIntervals={15}
              dateFormat="MM/dd/yyyy h:mm aa"
              isClearable
            />
            <button className="ghost-btn" type="button" onClick={applyFilters}>
              {t("filter")}
            </button>
          <button className="ghost-btn" type="button" onClick={resetFilters}>
            {t("clear")}
          </button>
        </div>
          <button className="primary" onClick={openNewModal} disabled={!canManage}>
            {t("addAnnouncement") || "Add announcement"}
          </button>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>{t("image")}</th>
              <th>{t("title") || "Title"}</th>
              <th>{t("description")}</th>
              <th>{t("link") || "Link"}</th>
              <th>{t("from") || "From"}</th>
              <th>{t("till") || "Till"}</th>
              <th>{t("enabled") || "Enabled"}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {announcements.length === 0 ? (
              <tr>
                <td colSpan={8} className="muted">No announcements</td>
              </tr>
            ) : (
              announcements.map((announcement) => (
                <tr key={announcement._id} className="productRow">
                  <td className="prodImgCell">
                    {editingId === announcement._id ? (
                      <div className="thumb-row">
                        {editDraft.image?.url ? (
                          <div className="listImage">
                            <img src={editDraft.image.url} alt="" />
                            <button type="button" className="removeImageBtn" onClick={removeEditImage}>
                              <img src="deleteIcon.png" alt="" />
                            </button>
                          </div>
                        ) : (
                          <div className="defaultImage">
                            <img src="announcementIcon.png" alt="" className="medium" />
                          </div>
                        )}
                        <div className="uploadDiv" style={{ marginBottom: 10 }}>
                          <label htmlFor={`promoImg${announcement._id}`} className="uploadBtn">
                            {editUploadingId === announcement._id ?
                              <img src="loading.gif" className="noFilter" />
                              :
                              editDraft.image?.url ?
                                <img src="editIcon.png" />
                                :
                                <img src="plusIcon.png" />
                            }
                          </label>
                          <input
                            id={`promoImg${announcement._id}`}
                            type="file"
                            accept="image/*"
                            className="uploadForm"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setEditUploadingId(announcement._id);
                                uploadToImageKit(
                                  file,
                                  (img) => setEditDraft((prev) => ({ ...prev, image: img })),
                                  (flag) => (flag ? setEditUploadingId(announcement._id) : setEditUploadingId(null)),
                                  (msg) => setEditError(msg)
                                );
                              }
                            }}
                            disabled={editUploadingId === announcement._id || !canUpload}
                          />
                        </div>
                      </div>
                    ) : announcement.image?.url ? (
                      <div className="listImage">
                        <img src={announcement.image.url} alt="" />
                      </div>
                    ) : (
                      <div className="defaultImage">
                        <img src="announcementIcon.png" alt="" className="medium" />
                      </div>
                    )}
                  </td>
                  <td>
                    {editingId === announcement._id ? (
                      <input
                        value={editDraft.title || ""}
                        onChange={(e) => setEditDraft({ ...editDraft, title: e.target.value })}
                        placeholder="Optional"
                      />
                    ) : (
                      announcement.title || "-"
                    )}
                  </td>
                  <td>
                    {editingId === announcement._id ? (
                      <input
                        value={editDraft.description || ""}
                        onChange={(e) => setEditDraft({ ...editDraft, description: e.target.value })}
                        placeholder="Optional"
                      />
                    ) : (
                      announcement.description || "-"
                    )}
                  </td>
                  <td>
                    {editingId === announcement._id ? (
                      <input
                        value={editDraft.link || ""}
                        onChange={(e) => setEditDraft({ ...editDraft, link: e.target.value })}
                        placeholder="https://..."
                      />
                    ) : announcement.link ? (
                      <a href={announcement.link} target="_blank" rel="noreferrer">
                        {announcement.link}
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td>
                    {editingId === announcement._id ? (
                      <DatePicker
                        className="filter-input date-picker"
                        selected={toDate(editDraft.startsAt)}
                        onChange={(date) => setEditDraft({ ...editDraft, startsAt: date || undefined })}
                        showTimeInput
                        timeFormat="HH:mm"
                        timeIntervals={15}
                        dateFormat="MM/dd/yyyy h:mm aa"
                        isClearable
                      />
                    ) : announcement.startsAt ? (
                      new Date(announcement.startsAt).toLocaleString()
                    ) : (
                      "-"
                    )}
                  </td>
                  <td>
                    {editingId === announcement._id ? (
                      <DatePicker
                        className="filter-input date-picker"
                        selected={toDate(editDraft.endsAt)}
                        onChange={(date) => setEditDraft({ ...editDraft, endsAt: date || undefined })}
                        showTimeInput
                        timeFormat="HH:mm"
                        timeIntervals={15}
                        dateFormat="MM/dd/yyyy h:mm aa"
                        isClearable
                      />
                    ) : announcement.endsAt ? (
                      new Date(announcement.endsAt).toLocaleString()
                    ) : (
                      "-"
                    )}
                  </td>
                  <td>
                    {editingId === announcement._id ? (
                      <div className="checkboxContainer">
                        <input
                          id={`editCheckbox${announcement._id}`}
                          type="checkbox"
                          checked={Boolean(editDraft.isEnabled)}
                          onChange={(e) => setEditDraft({ ...editDraft, isEnabled: e.target.checked })}
                        />
                        <label htmlFor={`editCheckbox${announcement._id}`}></label>
                      </div>

                    ) : (
                      announcement.isEnabled ? (t("yes") || "Yes") : (t("no") || "No")
                    )}
                  </td>
                  <td>
                    {editingId === announcement._id ? (
                      <div className="flex">
                        <button className="ghost-btn" onClick={saveEdit}>
                          {t("save")}
                        </button>
                        <button className="ghost-btn" onClick={cancelEdit}>
                          {t("cancel")}
                        </button>
                        <button className="ghost-btn danger" onClick={() => deleteAnnouncement(announcement._id).then(load)}>
                          {t("delete")}
                        </button>
                        {editError && <div className="error">{editError}</div>}
                      </div>
                    ) : canManage ? (
                      <div className="flex">
                        <button className="ghost-btn" onClick={() => startEdit(announcement)}>
                          {t("edit")}
                        </button>
                        <button className="ghost-btn danger" onClick={() => deleteAnnouncement(announcement._id).then(load)}>
                          {t("delete")}
                        </button>
                      </div>
                    ) : (
                      <div className="muted">{t("noPermissionAction")}</div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      {showNewModal && canManage && (
        <div className="modal-backdrop" onClick={closeNewModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{t("newAnnouncement") || "New Announcement"}</div>
              <button className="ghost-btn" type="button" onClick={closeNewModal}>
                {t("close")}
              </button>
            </div>
            <form className="form productRow" onSubmit={submit}>
              <label>
                {t("title") || "Title"}
                <input value={draft.title || ""} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
              </label>

              <label>
                {t("description")}
                <input value={draft.description || ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
              </label>

              <label>
                {t("link") || "Link"}
                <input value={draft.link || ""} onChange={(e) => setDraft({ ...draft, link: e.target.value })} placeholder="https://..." />
              </label>

              <div style={{ display: 'flex', gap: '20px' }}>
                <label style={{ flex: 1 }}>
                  {t("from") || "From"}
                  <DatePicker
                    className="filter-input date-picker"
                    selected={toDate(draft.startsAt)}
                    onChange={(date) => setDraft({ ...draft, startsAt: date || undefined })}
                    showTimeInput
                    timeFormat="HH:mm"
                    timeIntervals={15}
                    dateFormat="MM/dd/yyyy h:mm aa"
                    isClearable
                  />
                </label>

                <label style={{ flex: 1 }}>
                  {t("till") || "Till"}
                  <DatePicker
                    className="filter-input date-picker"
                    selected={toDate(draft.endsAt)}
                    onChange={(date) => setDraft({ ...draft, endsAt: date || undefined })}
                    showTimeInput
                    timeFormat="HH:mm"
                    timeIntervals={15}
                    dateFormat="MM/dd/yyyy h:mm aa"
                    isClearable
                  />
                </label>
              </div>

              <div className="checkboxContainer">
                <input
                  id="isEnabled"
                  type="checkbox"
                  checked={Boolean(draft.isEnabled)}
                  onChange={(e) => setDraft({ ...draft, isEnabled: e.target.checked })}
                />
                <label htmlFor="isEnabled">
                  {t("enabled") || "Enabled"}
                </label>
              </div>

              <label style={{ margin: 0 }}>
                {t("image")}
              </label>
              <div className="thumb-row prodImgCell">
                {draft.image?.url ? (
                  <div className="thumb listImage newThumb">
                    <img src={draft.image.url} alt="" />
                    <button type="button" className="removeImageBtn" onClick={removeNewImage}>
                      <img src="deleteIcon.png" alt="" />
                    </button>
                  </div>
                ) : (
                  <div className="defaultImage big">
                    <img src="announcementIcon.png" alt="" className="medium" />
                  </div>
                )}

                <div className="uploadDiv">
                  <label htmlFor="promoImgUpload" className="uploadBtn">
                    {uploadingNew ?
                      <img src="loading.gif" className="noFilter" />
                      :
                      draft.image?.url ?
                        <img src="editIcon.png" />
                        :
                        <img src="plusIcon.png" />
                    }
                  </label>
                  <input
                    type="file"
                    id="promoImgUpload"
                    accept="image/*"
                    className="uploadForm"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file)
                        uploadToImageKit(
                          file,
                          (img) => setDraft({ ...draft, image: img }),
                          setUploadingNew,
                          (msg) => setFormError(msg)
                        );
                    }}
                    disabled={uploadingNew || !canUpload}
                  />
                </div>
              </div>
              {formError && <div className="error">{formError}</div>}
              <div className="modal-actions">
                <button className="ghost-btn" type="button" onClick={closeNewModal}>
                  {t("cancel")}
                </button>
                <button className="primary" type="submit" disabled={!canManage}>
                  {t("save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default AnnouncementsPage;
