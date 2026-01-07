import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Card from "../components/Card";
import type { Category, Product, ProductImage } from "../types/api";
import { deleteProduct, fetchCategories, fetchProducts, getImageKitAuth, saveProduct } from "../api/client";
import { useI18n } from "../context/I18nContext";

const uploadUrl = import.meta.env.VITE_IMAGEKIT_UPLOAD_URL || "https://upload.imagekit.io/api/v1/files/upload";

const ProductsPage = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [draft, setDraft] = useState<Partial<Product>>({ images: [] });
  const [uploadingNew, setUploadingNew] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<Product>>({});
  const [editUploadingId, setEditUploadingId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const [editError, setEditError] = useState("");
  const { t } = useI18n();

  const getFilterParams = () => ({
    q: searchTerm.trim() || undefined,
    category: filterCategory || undefined,
  });

  const loadProducts = (params?: { q?: string; category?: string }) => {
    fetchProducts(params).then(setProducts).catch(console.error);
  };

  const load = () => {
    loadProducts(getFilterParams());
    fetchCategories().then(setCategories).catch(console.error);
  };

  useEffect(() => {
    load();
  }, []);

  const applyFilters = () => {
    loadProducts(getFilterParams());
  };

  const resetFilters = () => {
    setSearchTerm("");
    setFilterCategory("");
    loadProducts();
  };

  const openNewModal = () => {
    setDraft({ images: [] });
    setFormError("");
    setShowNewModal(true);
  };

  const closeNewModal = () => {
    setShowNewModal(false);
  };

  const uploadToImageKit = async (
    file: File,
    onDone: (img: ProductImage) => void,
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
    try {
      const saved = await saveProduct(draft);
      setDraft({ images: [] });
      setProducts((prev) => {
        const exists = prev.find((p) => p._id === saved._id);
        if (exists) return prev.map((p) => (p._id === saved._id ? saved : p));
        return [saved, ...prev];
      });
      applyFilters();
      setFormError("");
      setShowNewModal(false);
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Create failed";
      setFormError(msg);
    }
  };

  const startEdit = (p: Product) => {
    setEditingId(p._id);
    setEditDraft({
      _id: p._id,
      name: p.name,
      description: p.description,
      price: p.price,
      stock: p.stock,
      images: p.images || [],
      // backend validator expects an id string, so normalize populated categories
      category: typeof p.category === "string" ? p.category : p.category?._id,
    });
    setEditError("");
  };

  const removeNewImage = (fileId: string) => {
    setDraft((prev) => ({
      ...prev,
      images: (prev.images as ProductImage[] | undefined)?.filter((img) => img.fileId !== fileId) || [],
    }));
  };

  const removeEditImage = (fileId: string) => {
    setEditDraft((prev) => ({
      ...prev,
      images: (prev.images as ProductImage[] | undefined)?.filter((img) => img.fileId !== fileId) || [],
    }));
  };

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      const payload = { ...editDraft, _id: editingId };
      const saved = await saveProduct(payload);
      setProducts((prev) => prev.map((p) => (p._id === saved._id ? saved : p)));
      setEditingId(null);
      setEditDraft({});
      applyFilters();
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

  return (
    <>
      <div className="page-header">
        <div className="filters">
          <input
            className="filter-input"
            placeholder={t("searchName")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select className="filter-select" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
            <option value="">{t("category")}</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
          <button className="ghost-btn" type="button" onClick={applyFilters}>
            {t("filter")}
          </button>
          <button className="ghost-btn" type="button" onClick={resetFilters}>
            {t("clear")}
          </button>
        </div>
        <button className="primary" onClick={openNewModal}>
          {t("addProduct")}
        </button>
      </div>

      <div className="grid single-col">
        <Card title={t("nav.products")} subTitle={`(${products.length})`}>
          <table className="table">
            <thead>
              <tr>
                <th>{t("images")}</th>
                <th>{t("name")}</th>
                <th>{t("description")}</th>
                <th>{t("category")}</th>
                <th>{t("price")}</th>
                <th>{t("stock")}</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              {products.length == 0 ? (
                <tr>
                  <td colSpan={6} className="muted">No products</td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr key={product._id} className="productRow">
                    <td className="prodImgCell">
                      {editingId === product._id ? (
                        <div className="thumb-row">
                          {((editDraft.images as ProductImage[]) || []).length > 0 && (
                            ((editDraft.images as ProductImage[]) || []).map((img) => (
                              <div key={img.fileId} className="thumb">
                                <div className="listImage">
                                  <img src={img.url} alt="" />
                                  <button
                                    type="button"
                                    className="removeImageBtn"
                                    style={{}}
                                    onClick={() => removeEditImage(img.fileId)}
                                  >
                                    <img src="deleteIcon.png" alt="" />
                                  </button>
                                </div>
                              </div>
                            ))
                          )}

                          <div className="uploadDiv" style={{}}>
                            <label htmlFor={`prodImg${product._id}`} className="uploadBtn">
                              {editUploadingId === product._id ?
                                <img src="loading.gif" className="noFilter" />
                                :
                                <img src="plusIcon.png" />
                              }
                            </label>
                            <input
                              type="file"
                              id={`prodImg${product._id}`}
                              className="uploadForm"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  setEditUploadingId(product._id);
                                  uploadToImageKit(
                                    file,
                                    (img) =>
                                      setEditDraft((prev) => ({
                                        ...prev,
                                        images: [...((prev.images as ProductImage[]) || []), img],
                                      })),
                                    (flag) => (flag ? setEditUploadingId(product._id) : setEditUploadingId(null)),
                                    (msg) => setEditError(msg)
                                  );
                                }
                              }}
                              disabled={editUploadingId === product._id}
                            />
                          </div>

                        </div>
                      ) : (
                        product.images?.[0]?.url ? (
                          <div className="listImage">
                            <img src={product.images[0].url} alt={product.name} />
                          </div>
                        ) : (
                          <div className="defaultImage">
                            <img src="productIcon.png" alt="" className="medium" />
                          </div>
                        )
                      )}


                    </td>

                    <td>
                      {editingId === product._id ? (
                        <input value={editDraft.name || ""} onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })} />
                      ) : (
                        product.name
                      )}
                    </td>
                    <td>
                      {editingId === product._id ? (
                        <input
                          value={editDraft.description || ""}
                          onChange={(e) => setEditDraft({ ...editDraft, description: e.target.value })}
                          placeholder=""
                        />
                      ) : (
                        product.description || "-"
                      )}
                    </td>
                    <td>
                      {editingId === product._id ? (
                        <select
                          value={(editDraft.category as string) || ""}
                          onChange={(e) => setEditDraft({ ...editDraft, category: e.target.value })}
                          required
                        >
                          <option value="">Select</option>
                          {categories.map((c) => (
                            <option key={c._id} value={c._id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        typeof product.category === "string"
                          ? categories.find((c) => c._id === product.category)?.name || "-"
                          : product.category?.name || "-"
                      )}
                    </td>
                    <td>
                      {editingId === product._id ? (
                        <input
                          type="number"
                          value={editDraft.price ?? product.price}
                          onChange={(e) => setEditDraft({ ...editDraft, price: Number(e.target.value) })}
                        />
                      ) : (
                        product.price.toLocaleString()
                      )}
                    </td>
                    <td>
                      {editingId === product._id ? (
                        <input
                          type="number"
                          value={editDraft.stock ?? product.stock}
                          onChange={(e) => setEditDraft({ ...editDraft, stock: Number(e.target.value) })}
                        />
                      ) : (
                        product.stock
                      )}
                    </td>

                    <td style={{}}>
                    {editingId === product._id ? (
                      <div className="flex">
                        <button className="ghost-btn" onClick={saveEdit}>
                          {t("save")}
                        </button>
                        <button className="ghost-btn" onClick={cancelEdit}>
                          {t("cancel")}
                        </button>
                        <button className="ghost-btn danger" onClick={() => deleteProduct(product._id).then(load)}>
                          {t("delete")}
                        </button>
                        {editError && <div className="error">{editError}</div>}
                      </div>
                    ) : (
                      <div className="flex">
                        <button className="ghost-btn" onClick={() => startEdit(product)}>
                          {t("edit")}
                        </button>
                        <button className="ghost-btn danger" onClick={() => deleteProduct(product._id).then(load)}>
                          {t("delete")}
                        </button>
                      </div>
                    )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
      </div>

      {showNewModal && (
        <div className="modal-backdrop" onClick={closeNewModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{t("newProduct")}</div>
              <button className="ghost-btn" type="button" onClick={closeNewModal}>
                {t("close")}
              </button>
            </div>
            <form className="form productRow" onSubmit={submit}>
              <label>
                {t("name")}
                <input value={draft.name || ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
              </label>
              <label>
                {t("description")}
                <input
                  value={draft.description || ""}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  placeholder=""
                />
              </label>
              <label>
                {t("price")} (SYP)
                <input
                  type="number"
                  value={draft.price || ""}
                  onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })}
                  required
                />
              </label>
              <label>
                {t("stock")}
                <input type="number" value={draft.stock ?? 0} onChange={(e) => setDraft({ ...draft, stock: Number(e.target.value) })} />
              </label>
              <label>
                {t("category")}
                <select value={(draft.category as string) || ""} onChange={(e) => setDraft({ ...draft, category: e.target.value })} required>
                  <option value="">Select</option>
                  {categories.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ margin: 0 }}>
                {t("images")} ({draft.images?.length})
              </label>

              <div className="thumb-row prodImgCell">
                {draft.images?.length == 0 ? (
                  <div className="defaultImage big">
                    <img src="productIcon.png" alt="" />
                  </div>
                ) : (
                  (draft.images as ProductImage[] | undefined)?.map((img) => (
                    <div key={img.fileId} className="thumb listImage newThumb">
                      <img src={img.url} alt="" />
                      <button
                        type="button"
                        className="removeImageBtn"
                        style={{}}
                        onClick={() => removeNewImage(img.fileId)}
                      >
                        <img src="deleteIcon.png" alt="" />
                      </button>
                    </div>
                  ))
                )}

                <div className="uploadDiv" style={{}}>
                  <label htmlFor="prodImgUpload" className="uploadBtn">
                    {uploadingNew ? <img src="loading.gif" className="noFilter" /> : <img src="plusIcon.png" />}
                  </label>
                  <input
                    type="file"
                    id="prodImgUpload"
                    accept="image/*"
                    className="uploadForm"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file)
                        uploadToImageKit(
                          file,
                          (img) => setDraft((d) => ({ ...d, images: [...((d.images as ProductImage[]) || []), img] })),
                          setUploadingNew,
                          (msg) => setFormError(msg)
                        );
                    }}
                    disabled={uploadingNew}
                  />
                </div>
              </div>

              {formError && <div className="error">{formError}</div>}
              <div className="modal-actions">
                <button className="ghost-btn" type="button" onClick={closeNewModal}>
                  {t("cancel")}
                </button>
                <button className="primary" type="submit">
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

export default ProductsPage;
