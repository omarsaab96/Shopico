import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Card from "../components/Card";
import type { Category, Product, ProductImage } from "../types/api";
import { bulkUpdateProductPrices, deleteProduct, fetchCategories, fetchProducts, getImageKitAuth, saveProduct } from "../api/client";
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
  const [categorySearch, setCategorySearch] = useState("");
  const [editCategorySearch, setEditCategorySearch] = useState("");
  const [showEditCategories, setShowEditCategories] = useState(false);
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [promoteProduct, setPromoteProduct] = useState<Product | null>(null);
  const [promotePrice, setPromotePrice] = useState("");
  const [promoteActive, setPromoteActive] = useState(true);
  const [promoteSaving, setPromoteSaving] = useState(false);
  const [promoteError, setPromoteError] = useState("");
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [priceMode, setPriceMode] = useState<"INCREASE" | "DISCOUNT">("INCREASE");
  const [priceAmountType, setPriceAmountType] = useState<"FIXED" | "PERCENT">("FIXED");
  const [priceAmount, setPriceAmount] = useState("");
  const [priceSaving, setPriceSaving] = useState(false);
  const [priceError, setPriceError] = useState("");
  const { t } = useI18n();

  const getFilterParams = () => ({
    q: searchTerm.trim() || undefined,
    category: filterCategory || undefined,
    includeUnavailable: true,
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
    setDraft({ images: [], categories: [], isAvailable: true });
    setFormError("");
    setCategorySearch("");
    setShowNewModal(true);
  };

  const closeNewModal = () => {
    setShowNewModal(false);
  };

  const openPriceModal = () => {
    setPriceMode("INCREASE");
    setPriceAmountType("FIXED");
    setPriceAmount("");
    setPriceError("");
    setShowPriceModal(true);
  };

  const closePriceModal = () => {
    if (priceSaving) return;
    setShowPriceModal(false);
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
      isAvailable: p.isAvailable,
      images: p.images || [],
      categories: Array.isArray(p.categories) ? p.categories.map((c) => (typeof c === "string" ? c : c._id)) : [],
    });
    setEditError("");
    setEditCategorySearch("");
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
    setShowEditCategories(false);
  };

  const openPromote = (product: Product) => {
    setPromoteProduct(product);
    setPromotePrice(String(product.promoPrice ?? product.price));
    setPromoteActive(Boolean(product.isPromoted));
    setPromoteError("");
    setShowPromoteModal(true);
  };

  const closePromote = () => {
    if (promoteSaving) return;
    setShowPromoteModal(false);
    setPromoteProduct(null);
    setPromotePrice("");
    setPromoteActive(true);
    setPromoteError("");
  };

  const promoteValue = Number(promotePrice);
  const promoteOldPrice = promoteProduct?.price ?? 0;
  const hasPromoteValue =
    Boolean(promoteProduct) && promotePrice.trim().length > 0 && !Number.isNaN(promoteValue) && promoteValue > 0;
  const promoteDelta = hasPromoteValue && promoteOldPrice > 0
    ? ((promoteOldPrice - promoteValue) / promoteOldPrice) * 100
    : null;

  const savePromote = async () => {
    if (!promoteProduct) return;
    if (promoteActive && !hasPromoteValue) {
      setPromoteError(t("invalidAmount") || "Enter a valid amount");
      return;
    }
    setPromoteSaving(true);
    setPromoteError("");
    try {
      const payload: Partial<Product> = {
        _id: promoteProduct._id,
        isPromoted: promoteActive,
        promoPrice: promoteActive ? promoteValue : undefined,
      };
      const saved = await saveProduct(payload);
      setProducts((prev) => prev.map((p) => (p._id === saved._id ? saved : p)));
      closePromote();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Update failed";
      setPromoteError(msg);
    } finally {
      setPromoteSaving(false);
    }
  };

  const submitPriceUpdate = async (e: FormEvent) => {
    e.preventDefault();
    const amountValue = Number(priceAmount);
    if (!amountValue || amountValue <= 0 || Number.isNaN(amountValue)) {
      setPriceError(t("invalidAmount") || "Enter a valid amount");
      return;
    }
    if (priceAmountType === "PERCENT" && priceMode === "DISCOUNT" && amountValue > 100) {
      setPriceError(t("maxDiscount") || "Percentage discount cannot exceed 100");
      return;
    }
    setPriceSaving(true);
    setPriceError("");
    try {
      await bulkUpdateProductPrices({
        mode: priceMode,
        amountType: priceAmountType,
        amount: amountValue,
      });
      setShowPriceModal(false);
      loadProducts(getFilterParams());
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Update failed";
      setPriceError(msg);
    } finally {
      setPriceSaving(false);
    }
  };

  const renderCategorySelect = (
    selectedIds: string[] | undefined,
    setSelected: (ids: string[]) => void,
    search: string,
    setSearch: (value: string) => void
  ) => {
    const list = selectedIds || [];
    const filtered = categories.filter((c) => {
      const term = search.trim().toLowerCase();
      if (!term) return true;
      return c.name?.toLowerCase().includes(term) || c.description?.toLowerCase().includes(term);
    });

    return (
      <div className="multi-select">
        <div className="flex">
          <div className="multiSelectSearch">
            <input
              className="filter-input"
              placeholder={t("searchCategory")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="ghost-btn" type="button" onClick={() => setSearch("")}>
                {t("clear")}
              </button>
            )}
          </div>

          <div className="multi-select-actions">
            <button
              className="ghost-btn"
              type="button"
              onClick={() => {
                if (list.length === categories.length) {
                  setSelected([]);
                } else {
                  setSelected(categories.map((c) => c._id));
                }
              }}
            >
              {list.length === categories.length ? (t("clearAll") || "Clear all") : (t("selectAll") || "Select all")}
            </button>
            {list.length > 0 && (
              <div className="multi-select-count">
                {t("selected") || "Selected"}: {list.length}
              </div>
            )}
          </div>
        </div>

        <div className="multi-select-list">
          {filtered.length === 0 ? (
            <div className="muted">{t("noResults") || "No results"}</div>
          ) : (
            filtered.map((c) => {
              const checked = list.includes(c._id);
              return (
                <div key={c._id} className="checkboxContainer multi-select-item">
                  <input
                    id={`userSelect${c._id}`}
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setSelected(checked ? list.filter((id) => id !== c._id) : [...list, c._id])
                    }
                  />
                  <label htmlFor={`userSelect${c._id}`}>
                    {c.name}
                  </label>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  const getCategoryLabels = (value?: Product["categories"]) => {
    if (!value || value.length === 0) return "-";
    const ids = value.map((c) => (typeof c === "string" ? c : c._id));
    const labels = ids.map((id) => categories.find((c) => c._id === id)?.name || id);
    if (labels.length <= 2) return labels.join(", ");
    return `${labels.slice(0, 2).join(", ")} +${labels.length - 2}`;
  };

  return (
    <>
      <Card title={t("nav.products")} subTitle={`(${products.length})`}>
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
          <div className="flex" style={{gap:10}}>
            <button className="primary" onClick={openNewModal}>
              {t("addProduct")}
            </button>
            <button className="ghost-btn" type="button" onClick={openPriceModal}>
              {t("changePrices") || "Change prices"}
            </button>
          </div>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>{t("images")}</th>
              <th>{t("name")}</th>
              <th>{t("description")}</th>
              <th>{t("category")}</th>
              <th>{t("price")}</th>
              <th>{t("promoStatus") || "Promo"}</th>
              <th>{t("available") || "Available"}</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            {products.length == 0 ? (
              <tr>
                <td colSpan={8} className="muted">No products</td>
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
                      <div className="flex">
                        <span>{getCategoryLabels(editDraft.categories as string[] | undefined)}</span>
                        <button className="ghost-btn" type="button" onClick={() => setShowEditCategories(true)}>
                          {t("changeCategories") || "Change categories"}
                        </button>
                      </div>
                    ) : (
                      getCategoryLabels(product.categories)
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
                    {product.isPromoted ? (t("yes") || "Yes") : (t("no") || "No")}
                    {product.isPromoted && ` (${product.promoPrice?.toLocaleString()})`}
                  </td>
                  <td>
                    {editingId === product._id ? (
                      <div className="checkboxContainer">
                        <input
                          id={`productEditIsAvailable${product._id}`}
                          type="checkbox"
                          checked={Boolean(editDraft.isAvailable)}
                          onChange={(e) => setEditDraft({ ...editDraft, isAvailable: e.target.checked })}
                        />
                        <label htmlFor={`productEditIsAvailable${product._id}`}></label>
                      </div>

                    ) : (
                      product.isAvailable ? (t("yes") || "Yes") : (t("no") || "No")
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
                        <button className="ghost-btn" onClick={() => openPromote(product)}>
                          {t("promote") || "Promote"}
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

      {showEditCategories && editingId && (
        <div
          className="modal-backdrop"
          onClick={() => {
            setShowEditCategories(false);
            setEditCategorySearch("");
          }}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{t("changeCategories") || "Change categories"}</div>
              <button
                className="ghost-btn"
                type="button"
                onClick={() => {
                  setShowEditCategories(false);
                  setEditCategorySearch("");
                }}
              >
                {t("close")}
              </button>
            </div>
            {renderCategorySelect(
              editDraft.categories as string[] | undefined,
              (ids) => setEditDraft({ ...editDraft, categories: ids as any }),
              editCategorySearch,
              setEditCategorySearch
            )}
          </div>
        </div>
      )}

      {showPromoteModal && promoteProduct && (
        <div className="modal-backdrop" onClick={closePromote}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{t("promote") || "Promote"}</div>
              <button className="ghost-btn" type="button" onClick={closePromote}>
                {t("close")}
              </button>
            </div>
            <div className="form">
              <div className="checkboxContainer">
                <input
                  id="promoteActive"
                  type="checkbox"
                  checked={promoteActive}
                  onChange={(e) => setPromoteActive(e.target.checked)}
                />
                <label htmlFor="promoteActive">{t("active") || "Active"}</label>
              </div>
              <label>
                {t("oldPrice") || "Old price"}
                <input value={promoteOldPrice.toLocaleString()} readOnly />
              </label>
              <label>
                {t("newPrice") || "New price"}
                <input
                  type="number"
                  value={promotePrice}
                  onChange={(e) => setPromotePrice(e.target.value)}
                  min="0"
                  step="0.01"
                  disabled={!promoteActive}
                />
              </label>
              <label>
                {t("priceChange") || "Price change"}
                <div>
                  {!promoteActive || promoteDelta === null
                    ? "-"
                    : promoteDelta >= 0
                      ? `${t("discount") || "Discount"}: ${promoteDelta.toFixed(1)}%`
                      : `${t("increase") || "Increase"}: ${Math.abs(promoteDelta).toFixed(1)}%`}
                </div>
              </label>
            </div>
            {promoteError && <div className="error">{promoteError}</div>}
            <div className="modal-actions">
              <button className="ghost-btn" type="button" onClick={closePromote} disabled={promoteSaving}>
                {t("close")}
              </button>
              <button className="primary" type="button" onClick={savePromote} disabled={promoteSaving}>
                {promoteSaving ? (t("saving") || "Saving...") : t("save")}
              </button>
            </div>
          </div>
        </div>
      )}

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
              <div className="checkboxContainer">
                <input
                  id="newProductIsAvailable"
                  type="checkbox"
                  checked={Boolean(draft.isAvailable)}
                  onChange={(e) => setDraft({ ...draft, isAvailable: e.target.checked })}
                />

                <label htmlFor="newProductIsAvailable">
                  {t("isAvailable") || "Is available"}
                </label>
              </div>
              <label>
                {t("category")}
                {renderCategorySelect(
                  draft.categories as string[] | undefined,
                  (ids) => setDraft({ ...draft, categories: ids as any }),
                  categorySearch,
                  setCategorySearch
                )}
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

      {showPriceModal && (
        <div className="modal-backdrop" onClick={closePriceModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{t("changePrices") || "Change prices"}</div>
              <button className="ghost-btn" type="button" onClick={closePriceModal}>
                {t("close")}
              </button>
            </div>
            <form className="form" onSubmit={submitPriceUpdate}>
              <label>
                {t("changeType") || "Change type"}
                <div className="flex-col">
                  <div className="radioOption">
                    <input
                      id="priceChangeIncrease"
                      type="radio"
                      name="priceMode"
                      checked={priceMode === "INCREASE"}
                      onChange={() => setPriceMode("INCREASE")}
                    />
                    <label htmlFor="priceChangeIncrease">{t("increase") || "Increase"}</label>
                  </div>
                  <div className="radioOption">
                    <input
                      id="priceChangeDecrease"
                      type="radio"
                      name="priceMode"
                      checked={priceMode === "DISCOUNT"}
                      onChange={() => setPriceMode("DISCOUNT")}
                    />
                    <label htmlFor="priceChangeDecrease">{t("discount") || "Discount"}</label>
                  </div>
                </div>
              </label>
              <label>
                {t("amountType") || "Amount type"}
                <select
                  value={priceAmountType}
                  onChange={(e) => setPriceAmountType(e.target.value as "FIXED" | "PERCENT")}
                >
                  <option value="FIXED">{t("fixed") || "Fixed"}</option>
                  <option value="PERCENT">{t("percent") || "Percent"}</option>
                </select>
              </label>
              <label>
                {t("amount")}
                <input
                  type="number"
                  value={priceAmount}
                  onChange={(e) => setPriceAmount(e.target.value)}
                  min="0"
                  step="0.01"
                />
              </label>
              {priceError && <div className="error">{priceError}</div>}
              <div className="modal-actions">
                <button className="ghost-btn" type="button" onClick={closePriceModal} disabled={priceSaving}>
                  {t("cancel")}
                </button>
                <button className="primary" type="submit" disabled={priceSaving}>
                  {priceSaving ? (t("saving") || "Saving...") : t("apply")}
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
