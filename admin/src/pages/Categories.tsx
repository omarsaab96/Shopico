import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Card from "../components/Card";
import type { Category } from "../types/api";
import api, { fetchCategories, getImageKitAuth } from "../api/client";

const uploadUrl = import.meta.env.VITE_IMAGEKIT_UPLOAD_URL || "https://upload.imagekit.io/api/v1/files/upload";

const CategoriesPage = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [draft, setDraft] = useState<Partial<Category>>({});
  const [showNewModal, setShowNewModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<Category>>({});
  const [formError, setFormError] = useState("");
  const [editError, setEditError] = useState("");
  const [newUploading, setNewUploading] = useState(false);
  const [editUploadingId, setEditUploadingId] = useState<string | null>(null);

  const getFilterParams = () => ({
    q: searchTerm.trim() || undefined,
  });

  const load = (params?: { q?: string }) => fetchCategories(params).then(setCategories);

  useEffect(() => {
    load(getFilterParams());
  }, []);

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

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      setFormError("");
      await api.post("/categories", draft);
      setDraft({});
      setShowNewModal(false);
      load(getFilterParams());
    } catch (err: any) {
      const message = err?.response?.data?.message || "Could not save category";
      setFormError(message);
    }
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat._id);
    setEditDraft(cat);
    setEditError("");
  };

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      setEditError("");
      await api.put(`/categories/${editingId}`, editDraft);
      setEditingId(null);
      setEditDraft({});
      load(getFilterParams());
    } catch (err: any) {
      const message = err?.response?.data?.message || "Could not update category";
      setEditError(message);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft({});
    setEditError("");
  };

  const openNewModal = () => {
    setDraft({});
    setFormError("");
    setShowNewModal(true);
  };

  const closeNewModal = () => {
    setShowNewModal(false);
  };

  const clearFilters = () => {
    setSearchTerm("");
    load();
  };

  const applyFilters = () => {
    load(getFilterParams());
  };

  const removeNewImage = () => {
    setDraft((prev) => ({ ...prev, imageUrl: undefined }));
  };

  const removeEditImage = () => {
    setEditDraft((prev) => ({ ...prev, imageUrl: "" }));
  };

  return (
    <>
      <div className="page-header">
        <div className="filters">
          <input
            className="filter-input"
            placeholder="Search name or description"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button className="ghost-btn" type="button" onClick={applyFilters}>
            Filter
          </button>
          <button className="ghost-btn" type="button" onClick={clearFilters}>
            Clear
          </button>
        </div>
        <button className="primary" onClick={openNewModal}>
          Add category
        </button>
      </div>

      <div className="grid single-col">
        <Card title="Categories" subTitle={`(${categories.length})`}>
        <table className="table">
          <thead>
            <tr>
              <th>Image</th>
              <th>Name</th>
              <th>Description</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => (
              <tr key={cat._id} className="productRow">
                <td className="prodImgCell">
                  {editingId === cat._id ? (
                    <div className="thumb-row">
                      {(editDraft.imageUrl ?? cat.imageUrl) ? (
                        <div className="listImage">
                          <img src={(editDraft.imageUrl ?? cat.imageUrl) || ""} alt={cat.name} />
                          <button type="button" className="removeImageBtn" onClick={removeEditImage}>
                            <img src="deleteIcon.png" alt="" />
                          </button>
                        </div>
                      ) : (
                        <div className="defaultImage">
                          <img src="categoryIcon.png" alt="" className="small" />
                        </div>
                      )}
                      <div className="uploadDiv" style={{ marginBottom: 10 }}>
                        <label htmlFor={`catImg${cat._id}`} className="uploadBtn">
                          {editUploadingId === cat._id ? <img src="loading.gif" /> : <img src="plusIcon.png" />}
                        </label>
                        <input
                          id={`catImg${cat._id}`}
                          type="file"
                          accept="image/*"
                          className="uploadForm"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setEditUploadingId(cat._id);
                              uploadToImageKit(
                                file,
                                (url) => setEditDraft((prev) => ({ ...prev, imageUrl: url })),
                                (flag) => (flag ? setEditUploadingId(cat._id) : setEditUploadingId(null)),
                                (msg) => setEditError(msg)
                              );
                            }
                          }}
                          disabled={editUploadingId === cat._id}
                        />
                      </div>
                    </div>
                  ) : cat.imageUrl ? (
                    <div className="listImage" >
                      <img src={cat.imageUrl} alt={cat.name} />
                    </div>
                  ) : (
                    <div className="defaultImage">
                      <img src="categoryIcon.png" alt="" className="small" />
                    </div>
                  )}
                </td>
                <td>
                  {editingId === cat._id ? (
                    <input value={editDraft.name || ""} onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })} />
                  ) : (
                    cat.name
                  )}
                </td>
                <td>
                  {editingId === cat._id ? (
                    <input
                      value={editDraft.description || ""}
                      onChange={(e) => setEditDraft({ ...editDraft, description: e.target.value })}
                    />
                  ) : (
                    cat.description
                  )}
                </td>
                <td style={{}}>
                  {editingId === cat._id ? (
                    <>
                      <button className="ghost-btn mr-10" onClick={saveEdit}>
                        Save
                      </button>
                      <button className="ghost-btn mr-10" onClick={cancelEdit}>
                        Cancel
                      </button>
                      {editError && <div className="error">{editError}</div>}
                    </>
                  ) : (
                    <>
                      <button className="ghost-btn mr-10" onClick={() => startEdit(cat)}>
                        Edit
                      </button>
                      <button
                        className="ghost-btn danger"
                        onClick={() => api.delete(`/categories/${cat._id}`).then(() => load(getFilterParams()))}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      </div>

      {showNewModal && (
        <div className="modal-backdrop" onClick={closeNewModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">New Category</div>
              <button className="ghost-btn" type="button" onClick={closeNewModal}>
                Close
              </button>
            </div>
            <form className="form productRow" onSubmit={submit}>
              <label>
                Name
                <input value={draft.name || ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
              </label>
              <label>
                Description
                <input
                  value={draft.description || ""}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  placeholder="Optional"
                />
              </label>
              <label style={{ margin: 0 }}>
                Image
              </label>

              <div className="thumb-row prodImgCell">
                  {draft.imageUrl ? (
                    <div className="thumb listImage newThumb">
                      <img src={draft.imageUrl} alt="preview" />
                      <button
                        type="button"
                        className="removeImageBtn"
                        onClick={removeNewImage}
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
                      {newUploading ? <img src="loading.gif" /> : draft.imageUrl ? <img src="editIcon.png"/> : <img src="plusIcon.png"/>}
                    </label>
                    <input
                      id="catImgUpload"
                      type="file"
                      accept="image/*"
                      className="uploadForm"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file)
                          uploadToImageKit(
                            file,
                            (url) => setDraft({ ...draft, imageUrl: url }),
                            setNewUploading,
                            (msg) => setFormError(msg)
                          );
                      }}
                      disabled={newUploading}
                    />
                  </div>
                </div>
              {formError && <div className="error">{formError}</div>}
              <div className="modal-actions">
                <button className="ghost-btn" type="button" onClick={closeNewModal}>
                  Cancel
                </button>
                <button className="primary" type="submit">
                  Save Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default CategoriesPage;
