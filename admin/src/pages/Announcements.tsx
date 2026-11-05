import ModalSurface from "../components/ModalSurface";
import { useEffect, useId, useState } from "react";
import type { FormEvent } from "react";
import Card from "../components/Card";
import ImageEditorModal from "../components/ImageEditorModal";
import type { Announcement, AnnouncementImage } from "../types/api";
import { deleteAnnouncement, fetchAnnouncements, getImageKitAuth, saveAnnouncement, fetchBanners, saveBanner, deleteBanner } from "../api/client";
import { useI18n } from "../context/I18nContext";
import { usePermissions } from "../hooks/usePermissions";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { useBranch } from "../context/BranchContext";
import { confirmDelete } from "../utils/confirm";

const uploadUrl = import.meta.env.VITE_IMAGEKIT_UPLOAD_URL;

type AnnouncementDraft = Partial<Omit<Announcement, "startsAt" | "endsAt">> & {
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

const AnnouncementsPage = ({ banners = false }: { banners?: boolean }) => {
  const editorFormId = useId();
  const fetchItems = banners ? fetchBanners : fetchAnnouncements;
  const saveItem = banners ? saveBanner : saveAnnouncement;
  const deleteItem = banners ? deleteBanner : deleteAnnouncement;
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [draft, setDraft] = useState<AnnouncementDraft>({});
  const [saving, setSaving] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [uploadingNew, setUploadingNew] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterFrom, setFilterFrom] = useState<Date | null>(null);
  const [filterTo, setFilterTo] = useState<Date | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<AnnouncementDraft>({});
  const [editUploadingId, setEditUploadingId] = useState<string | null>(null);
  const [imageEditor, setImageEditor] = useState<{ file: File; target: "new" | "edit"; announcementId?: string } | null>(null);
  const [formError, setFormError] = useState("");
  const [editError, setEditError] = useState("");
  const [loading, setLoading] = useState(false);
  const { t } = useI18n();
  const { can } = usePermissions();
  const { selectedBranchId } = useBranch();
  const canManage = can(banners ? "banners:manage" : "announcements:manage");
  const canUpload = canManage;

  const getFilterParams = () => ({
    q: searchTerm.trim() || undefined,
    from: toIso(filterFrom),
    to: toIso(filterTo),
  });

  const load = async (params?: { q?: string; from?: string; to?: string }) => {
    setLoading(true);
    try {
      const data = await fetchItems(params);
      setAnnouncements(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedBranchId) return;
    load(getFilterParams());
  }, [selectedBranchId, banners]);

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
    if (!canManage || saving) return;
    cancelEdit();
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

  const uploadEditedImage = (editedFile: File) => {
    const target = imageEditor;
    setImageEditor(null);
    if (!target) return;
    if (target.target === "new") {
      uploadToImageKit(
        editedFile,
        (img) => setDraft((prev) => ({ ...prev, image: img })),
        setUploadingNew,
        (msg) => setFormError(msg)
      );
      return;
    }
    if (!target.announcementId) return;
    setEditUploadingId(target.announcementId);
    uploadToImageKit(
      editedFile,
      (img) => setEditDraft((prev) => ({ ...prev, image: img })),
      (flag) => (flag ? setEditUploadingId(target.announcementId || null) : setEditUploadingId(null)),
      (msg) => setEditError(msg)
    );
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!canManage || uploadingNew) return;
    if (banners && !draft.image) { setFormError(t("bannerImageRequired")); return; }
    setSaving(true);
    try {
      const payload = {
        ...draft,
        startsAt: toIso(draft.startsAt),
        endsAt: toIso(draft.endsAt),
      };
      const saved = await saveItem(payload);
      setAnnouncements((prev) => [saved, ...prev]);
      setDraft({});
      setFormError("");
      setShowNewModal(false);
      load();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Create failed";
      setFormError(msg);
    } finally { setSaving(false); }
  };

  const startEdit = (announcement: Announcement) => {
    if (!canManage) return;
    setShowNewModal(false);
    setEditingId(announcement._id);
    setEditDraft({
      ...announcement,
      startsAt: announcement.startsAt,
      endsAt: announcement.endsAt,
    });
    setEditError("");
  };

  const saveEdit = async () => {
    if (saving) return;
    if (!editingId || editUploadingId) return;
    if (banners && !editDraft.image) { setEditError(t("bannerImageRequired")); return; }
    if (!canManage) return;
    setSaving(true);
    try {
      const payload = {
        ...editDraft,
        _id: editingId,
        startsAt: toIso(editDraft.startsAt),
        endsAt: toIso(editDraft.endsAt),
      };
      const saved = await saveItem(payload);
      setAnnouncements((prev) => prev.map((p) => (p._id === saved._id ? saved : p)));
      setEditingId(null);
      setEditDraft({});
      load();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Update failed";
      setEditError(msg);
    } finally { setSaving(false); }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft({});
    setEditError("");
  };

  const removeNewImage = async () => {
    if (!(await confirmDelete(t))) return;
    setDraft((prev) => ({ ...prev, image: undefined }));
  };
  const removeEditImage = async () => {
    if (!(await confirmDelete(t))) return;
    setEditDraft((prev) => ({ ...prev, image: undefined }));
  };

  const modalDraft = editingId ? editDraft : draft;
  const setModalDraft = editingId ? setEditDraft : setDraft;
  const modalError = editingId ? editError : formError;
  const modalUploading = editingId ? editUploadingId === editingId : uploadingNew;
  const closeEditor = () => { if (saving || modalUploading) return; cancelEdit(); closeNewModal(); };

  return (
    <>
      <Card title={t(banners ? "nav.banners" : "nav.announcements") || "Announcements"} subTitle={`(${announcements.length})`}>
        {banners && <p className="muted">{t("bannerImageHint")}</p>}
        <div className="page-header">
          <form
            className="filters"
            onSubmit={(e) => {
              e.preventDefault();
              applyFilters();
            }}
          >
            <input
              className="filter-input"
              placeholder={t("searchAnnouncements") || "Search announcements"}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <DatePicker
              className="filter-input date-picker"
              selected={filterFrom}
              onChange={(date: Date | null) => setFilterFrom(date)}
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
              onChange={(date: Date | null) => setFilterTo(date)}
              placeholderText={t("till") || "Till"}
              showTimeInput
              timeFormat="HH:mm"
              timeIntervals={15}
              dateFormat="MM/dd/yyyy h:mm aa"
              isClearable
            />
            <button className="primary" type="submit">
              {t("filter")}
            </button>
          <button className="ghost-btn" type="button" onClick={resetFilters}>
            {t("clear")}
          </button>
        </form>
          {canManage && (
            <button className="primary" onClick={openNewModal}>
              {t(banners ? "addBanner" : "addAnnouncement") || "Add announcement"}
            </button>
          )}
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
            {loading ? (
              Array.from({ length: 6 }).map((_, idx) => (
                <tr key={`skeleton-${idx}`} className="productRow">
                  <td className="prodImgCell">
                    <div className="skeleton-block" style={{ width: 48, height: 48 }} />
                  </td>
                  <td><span className="skeleton-line w-180" /></td>
                  <td><span className="skeleton-line w-140" /></td>
                  <td><span className="skeleton-line w-120" /></td>
                  <td><span className="skeleton-line w-80" /></td>
                  <td><span className="skeleton-line w-80" /></td>
                  <td><span className="skeleton-line w-60" /></td>
                  <td><span className="skeleton-line w-120" /></td>
                </tr>
              ))
            ) : announcements.length === 0 ? (
              <tr>
                <td colSpan={8} className="muted">{t("noResults")}</td>
              </tr>
            ) : (
              announcements.map((announcement) => (
                <tr key={announcement._id} className="productRow">
                  <td className="prodImgCell">
                    {announcement.image?.url ? (
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
                    {(
                      announcement.title || "-"
                    )}
                  </td>
                  <td>
                    {(
                      announcement.description || "-"
                    )}
                  </td>
                  <td>
                    {announcement.link ? (
                      <a href={announcement.link} target="_blank" rel="noreferrer">
                        {announcement.link}
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td>
                    {announcement.startsAt ? (
                      new Date(announcement.startsAt).toLocaleString()
                    ) : (
                      "-"
                    )}
                  </td>
                  <td>
                    {announcement.endsAt ? (
                      new Date(announcement.endsAt).toLocaleString()
                    ) : (
                      "-"
                    )}
                  </td>
                  <td>
                    {(
                      announcement.isEnabled ? (t("yes") || "Yes") : (t("no") || "No")
                    )}
                  </td>
                  <td>
                    {canManage ? (
                      <div className="flex">
                        <button className="primary" onClick={() => startEdit(announcement)}>
                          {t("edit")}
                        </button>
                        <button className="ghost-btn danger" onClick={async () => (await confirmDelete(t)) && deleteItem(announcement._id).then(() => load(getFilterParams()))}>
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

      {imageEditor && (
        <ImageEditorModal
          file={imageEditor.file}
          onApply={uploadEditedImage}
          onCancel={() => setImageEditor(null)}
        />
      )}

      {(showNewModal || editingId) && canManage && (
        <div className="modal-backdrop" onClick={closeEditor}>
          <ModalSurface className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{t(banners ? (editingId ? "editBanner" : "newBanner") : (editingId ? "editAnnouncement" : "newAnnouncement")) || "New Announcement"}</div>
              <button className="ghost-btn" type="button" onClick={closeEditor} disabled={saving || modalUploading}>
                {t("close")}
              </button>
            </div>
            <form id={editorFormId} className="form productRow" onSubmit={editingId ? event => { event.preventDefault(); void saveEdit(); } : submit}>
              <label>
                {t("title") || "Title"}
                <input autoFocus value={modalDraft.title || ""} onChange={(e) => setModalDraft({ ...modalDraft, title: e.target.value })} />
              </label>

              <label>
                {t("description")}
                <input value={modalDraft.description || ""} onChange={(e) => setModalDraft({ ...modalDraft, description: e.target.value })} />
              </label>

              <label>
                {t("link") || "Link"}
                <input value={modalDraft.link || ""} onChange={(e) => setModalDraft({ ...modalDraft, link: e.target.value })} placeholder="https://..." />
              </label>

              <div style={{ display: 'flex', gap: '20px' }}>
                <label style={{ flex: 1 }}>
                  {t("from") || "From"}
                  <DatePicker
                    className="filter-input date-picker"
                    selected={toDate(modalDraft.startsAt)}
                    onChange={(date: Date | null) => setModalDraft({ ...modalDraft, startsAt: date || undefined })}
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
                    selected={toDate(modalDraft.endsAt)}
                    onChange={(date: Date | null) => setModalDraft({ ...modalDraft, endsAt: date || undefined })}
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
                  checked={Boolean(modalDraft.isEnabled)}
                  onChange={(e) => setModalDraft({ ...modalDraft, isEnabled: e.target.checked })}
                />
                <label htmlFor="isEnabled">
                  {t("enabled") || "Enabled"}
                </label>
              </div>

              <label style={{ margin: 0 }}>
                {t("image")}
              </label>
              <div className="thumb-row prodImgCell">
                {modalDraft.image?.url ? (
                  <div className="thumb listImage newThumb">
                    <img src={modalDraft.image.url} alt="" />
                    <button type="button" className="removeImageBtn" onClick={editingId ? removeEditImage : removeNewImage}>
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
                    {modalUploading ?
                      <img src="loading.gif" className="noFilter" />
                      :
                      modalDraft.image?.url ?
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
                      if (file) setImageEditor({ file, target: editingId ? "edit" : "new", announcementId: editingId || undefined });
                    }}
                    disabled={modalUploading || !canUpload}
                  />
                </div>
              </div>
              {modalError && <div className="error" role="alert">{modalError}</div>}
              
            </form>
            <div className="modal-actions">
                <button className="ghost-btn" type="button" onClick={closeEditor} disabled={saving || modalUploading}>
                  {t("cancel")}
                </button>
                {canManage && (
                  <button className="primary" type="submit" form={editorFormId} disabled={saving || modalUploading}>
                    {t(saving ? "saving" : "save")}
                  </button>
                )}
              </div>
          </ModalSurface>
        </div>
      )}
    </>
  );
};

export default AnnouncementsPage;
