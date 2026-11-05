import ModalSurface from "../components/ModalSurface";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Card from "../components/Card";
import ImageEditorModal from "../components/ImageEditorModal";
import type { Category } from "../types/api";
import api, { fetchCategories, getImageKitAuth } from "../api/client";
import type { HasImageFilter } from "../api/client";
import { useI18n } from "../context/I18nContext";
import { usePermissions } from "../hooks/usePermissions";
import { useBranch } from "../context/BranchContext";
import { confirmDelete } from "../utils/confirm";

const uploadUrl = import.meta.env.VITE_IMAGEKIT_UPLOAD_URL;

const CategoriesPage = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterHasImage, setFilterHasImage] = useState<"" | HasImageFilter>("");
  const [draft, setDraft] = useState<Partial<Category>>({});
  const [showNewModal, setShowNewModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<Category>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [editError, setEditError] = useState("");
  const [newUploading, setNewUploading] = useState(false);
  const [editUploadingId, setEditUploadingId] = useState<string | null>(null);
  const [imageEditor, setImageEditor] = useState<{ file: File; target: "new" | "edit"; categoryId?: string } | null>(null);
  const { t } = useI18n();
  const { can } = usePermissions();
  const { selectedBranchId } = useBranch();
  const canManage = can("categories:manage");
  const canUpload = canManage;

  const getFilterParams = () => ({
    q: searchTerm.trim() || undefined,
    hasImage: filterHasImage || undefined,
  });

  const load = async (params?: { q?: string; hasImage?: HasImageFilter }) => {
    setLoading(true);
    try {
      const data = await fetchCategories(params);
      setCategories(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedBranchId) return;
    load(getFilterParams());
  }, [selectedBranchId]);

  const uploadToImageKit = async (
    file: File,
    onDone: (url: string) => void,
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
      form.append('folder', '/shopico');

      if (publicKey) form.append("publicKey", publicKey);
      const res = await fetch(uploadUrl, {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as { url?: string; message?: string };
      if (!res.ok || !data?.url) {
        const msg = data?.message || "Upload failed";
        throw new Error(msg);
      }
      onDone(data.url);
    } catch (err: any) {
      const message = err?.message || "Image upload failed (check ImageKit keys)";
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
        (url) => setDraft((prev) => ({ ...prev, imageUrl: url })),
        setNewUploading,
        (msg) => setFormError(msg)
      );
      return;
    }
    if (!target.categoryId) return;
    setEditUploadingId(target.categoryId);
    uploadToImageKit(
      editedFile,
      (url) => setEditDraft((prev) => ({ ...prev, imageUrl: url })),
      (flag) => (flag ? setEditUploadingId(target.categoryId || null) : setEditUploadingId(null)),
      (msg) => setEditError(msg)
    );
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving || newUploading) return;
    setSaving(true);
    try {
      setFormError("");
      await api.post("/categories", draft);
      setDraft({});
      setShowNewModal(false);
      load(getFilterParams());
    } catch (err: any) {
      const message = err?.response?.data?.message || "Could not save category";
      setFormError(message);
    } finally { setSaving(false); }
  };

  const startEdit = (cat: Category) => {
    if (!canManage) return;
    setShowNewModal(false);
    setEditingId(cat._id);
    setEditDraft(cat);
    setEditError("");
  };

  const saveEdit = async () => {
    if (!editingId || saving || editUploadingId) return;
    setSaving(true);
    try {
      setEditError("");
      await api.put(`/categories/${editingId}`, editDraft);
      setEditingId(null);
      setEditDraft({});
      load(getFilterParams());
    } catch (err: any) {
      const message = err?.response?.data?.message || "Could not update category";
      setEditError(message);
    } finally { setSaving(false); }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft({});
    setEditError("");
  };

  const openNewModal = () => {
    if (!canManage) return;
    setDraft({});
    setFormError("");
    setShowNewModal(true);
  };

  const closeNewModal = () => {
    setShowNewModal(false);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setFilterHasImage("");
    load();
  };

  const applyFilters = () => {
    load(getFilterParams());
  };

  const removeNewImage = async () => {
    if (!(await confirmDelete(t))) return;
    setDraft((prev) => ({ ...prev, imageUrl: null }));
  };

  const removeEditImage = async () => {
    if (!(await confirmDelete(t))) return;
    setEditDraft((prev) => ({ ...prev, imageUrl: null }));
  };

  const modalDraft = editingId ? editDraft : draft;
  const setModalDraft = editingId ? setEditDraft : setDraft;
  const modalUploading = editingId ? editUploadingId === editingId : newUploading;
  const modalError = editingId ? editError : formError;
  const closeCategoryModal = () => { if (saving || modalUploading) return; closeNewModal(); cancelEdit(); };

  return (
    <>
      <Card title={t("nav.categories")} subTitle={`(${categories.length})`}>
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
              placeholder={t("searchCategory")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <select className="filter-select" value={filterHasImage} onChange={(e) => setFilterHasImage(e.target.value as "" | HasImageFilter)}>
              <option value="">{t("hasImageAll") === "hasImageAll" ? "Has image: All" : t("hasImageAll")}</option>
              <option value="yes">{t("hasImageYes") === "hasImageYes" ? "Has image: Yes" : t("hasImageYes")}</option>
              <option value="no">{t("hasImageNo") === "hasImageNo" ? "Has image: No" : t("hasImageNo")}</option>
            </select>
            <button className="primary" type="submit">
              {t("filter")}
            </button>
          <button className="ghost-btn" type="button" onClick={clearFilters}>
            {t("clear")}
          </button>
        </form>
          {canManage && (
            <button className="primary" onClick={openNewModal}>
              {t("addCategory")}
            </button>
          )}
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>{t("image")}</th>
              <th>{t("name")}</th>
              <th>{t("description")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, idx) => (
                <tr key={`skeleton-${idx}`} className="productRow">
                  <td className="prodImgCell">
                    <div className="skeleton-block" style={{ width: 40, height: 40 }} />
                  </td>
                  <td><span className="skeleton-line w-140" /></td>
                  <td><span className="skeleton-line w-180" /></td>
                  <td><span className="skeleton-line w-120" /></td>
                </tr>
              ))
            ) : categories.length == 0 ? (
              <tr>
                <td colSpan={6} className="muted">{t("noCategories")}</td>
              </tr>
            ) : (
              categories.map((cat) => (
                <tr key={cat._id} className="productRow">
                  <td className="prodImgCell">
                    {cat.imageUrl ? <div className="listImage"><img src={cat.imageUrl} alt={cat.name} /></div>
                      : <div className="defaultImage"><img src="categoryIcon.png" alt="" className="small" /></div>}
                  </td>
                  <td>{cat.name}</td>
                  <td>{cat.description}</td>
                  <td>{canManage && <div className="flex">
                    <button className="primary mr-10" type="button" onClick={() => startEdit(cat)}>{t("edit")}</button>
                    <button className="ghost-btn danger" type="button" onClick={async () => (await confirmDelete(t)) && api.delete(`/categories/${cat._id}`).then(() => load(getFilterParams()))}>{t("delete")}</button>
                  </div>}</td>
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
        <div className="modal-backdrop" onClick={closeCategoryModal}>
          <ModalSurface className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{t(editingId ? "editCategory" : "newCategory")}</div>
              <button className="ghost-btn" type="button" onClick={closeCategoryModal}>
                {t("close")}
              </button>
            </div>
            <form className="form productRow" onSubmit={editingId ? event => { event.preventDefault(); void saveEdit(); } : submit}>
              <label>
                {t("name")}
                <input value={modalDraft.name || ""} onChange={(e) => setModalDraft({ ...modalDraft, name: e.target.value })} required />
              </label>
              <label>
                {t("description")}
                <input
                  value={modalDraft.description || ""}
                  onChange={(e) => setModalDraft({ ...modalDraft, description: e.target.value })}
                  placeholder="Optional"
                />
              </label>
              <label style={{ margin: 0 }}>
                {t("image")}
              </label>

              <div className="thumb-row prodImgCell">
                {modalDraft.imageUrl ? (
                  <div className="thumb listImage newThumb">
                    <img src={modalDraft.imageUrl} alt="preview" />
                    <button
                      type="button"
                      className="removeImageBtn"
                      onClick={editingId ? removeEditImage : removeNewImage}
                    >
                      <img src="deleteIcon.png" alt="" />
                    </button>
                  </div>
                ) : (
                  <div className="defaultImage big">
                    <img src="categoryIcon.png" alt="" className="small" />
                  </div>
                )}

                <div className="uploadDiv">
                  <label htmlFor="catImgUpload" className="uploadBtn">
                    {modalUploading ? <img src="loading.gif" className="noFilter" /> : modalDraft.imageUrl ? <img src="editIcon.png" /> : <img src="plusIcon.png" />}
                  </label>
                  <input
                    id="catImgUpload"
                    type="file"
                    accept="image/*"
                    className="uploadForm"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setImageEditor({ file, target: editingId ? "edit" : "new", categoryId: editingId || undefined });
                    }}
                    disabled={modalUploading || !canUpload}
                  />
                </div>
              </div>
              {modalError && <div className="error" role="alert">{modalError}</div>}
              <div className="modal-actions">
                <button className="ghost-btn" type="button" onClick={closeCategoryModal}>
                  {t("cancel")}
                </button>
                {canManage && (
                  <button className="primary" type="submit" disabled={saving || modalUploading}>
                    {t(saving ? "saving" : "save")}
                  </button>
                )}
              </div>
            </form>
          </ModalSurface>
        </div>
      )}
    </>
  );
};

export default CategoriesPage;
