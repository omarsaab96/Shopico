import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Card from "../components/Card";
import type { Category } from "../types/api";
import api, { fetchCategories, getImageKitAuth } from "../api/client";

const uploadUrl = import.meta.env.VITE_IMAGEKIT_UPLOAD_URL || "https://upload.imagekit.io/api/v1/files/upload";

const CategoriesPage = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [draft, setDraft] = useState<Partial<Category>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<Category>>({});
  const [formError, setFormError] = useState("");
  const [editError, setEditError] = useState("");
  const [newUploading, setNewUploading] = useState(false);
  const [editUploadingId, setEditUploadingId] = useState<string | null>(null);

  const load = () => fetchCategories().then(setCategories);

  useEffect(() => {
    load();
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
      load();
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
      load();
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

  return (
    <div className="grid row-3col">
      <Card title="New Category" subTitle="">
        <form className="form" onSubmit={submit}>
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
          <label style={{margin:0}}>
            Image
            <div className="thumb-row">
              {draft.imageUrl ?
                <div className="thumb">
                  <img src={draft.imageUrl} alt="preview" style={{}} />
                </div>
                : (
                  <div className="defaultImage big">
                    <img src="categoryIcon.png" alt="" className="small" />
                  </div>
                )}

              <div className="uploadDiv">
                <label htmlFor="catImgUpload" className="uploadBtn">
                  {newUploading ? draft.imageUrl ? 'Changing...' : 'Uploading...' : draft.imageUrl ? 'Change' : 'Upload'}
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
          </label>
          {formError && <div className="error">{formError}</div>}
          <button className="primary">Save Category</button>
        </form>
      </Card>

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
              <tr key={cat._id}>
                <td>
                  {cat.imageUrl ? (
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
                      <input
                        type="file"
                        accept="image/*"
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
                      {editUploadingId === cat._id && <span className="pill">Uploading...</span>}
                      <button className="ghost-btn" onClick={saveEdit}>
                        Save
                      </button>
                      <button className="ghost-btn" onClick={cancelEdit}>
                        Cancel
                      </button>
                      {editError && <div className="error">{editError}</div>}
                    </>
                  ) : (
                    <>
                      <button className="ghost-btn mr-10" onClick={() => startEdit(cat)}>
                        Edit
                      </button>
                      <button className="ghost-btn danger" onClick={() => api.delete(`/categories/${cat._id}`).then(load)}>
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
  );
};

export default CategoriesPage;
