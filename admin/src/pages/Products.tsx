import { useEffect, useRef, useState } from "react";
import type { DragEvent, FormEvent } from "react";
import Card from "../components/Card";
import type { Category, Product, ProductImage } from "../types/api";
import { bulkUpdateProductPrices, deleteProduct, fetchCategories, fetchProducts, fetchProductsAdmin, getImageKitAuth, importProductsFromExcel, previewProductsImport, saveProduct } from "../api/client";
import { useI18n } from "../context/I18nContext";
import { usePermissions } from "../hooks/usePermissions";
import { useBranch } from "../context/BranchContext";

const uploadUrl = import.meta.env.VITE_IMAGEKIT_UPLOAD_URL;

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
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [pageLoading, setPageLoading] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importSaving, setImportSaving] = useState(false);
  const [importPreviewLoading, setImportPreviewLoading] = useState(false);
  const [importError, setImportError] = useState("");
  const [importResult, setImportResult] = useState<{ created: number; updated: number; skipped: number; total: number } | null>(null);
  const [importDragActive, setImportDragActive] = useState(false);
  const [importShowOnlyChanges, setImportShowOnlyChanges] = useState(true);
  const [importPreview, setImportPreview] = useState<{
    preview: {
      barcode: string;
      name: string;
      price: number | null;
      hasStock: boolean;
      action: string;
      reason?: string;
      reasonDetail?: string;
      previousName?: string;
      previousPrice?: number;
      previousHasStock?: boolean;
    }[];
    created: number; updated: number; skipped: number; total: number;
  } | null>(null);
  const [importPreviewProgress, setImportPreviewProgress] = useState(0);
  const [importPreviewLoaded, setImportPreviewLoaded] = useState(0);
  const [importPreviewTotal, setImportPreviewTotal] = useState(0);
  const [importPreviewStage, setImportPreviewStage] = useState<"upload" | "processing" | null>(null);
  const importPreviewAbortRef = useRef<AbortController | null>(null);
  const importPreviewTimerRef = useRef<number | null>(null);
  const { t } = useI18n();
  const { selectedBranchId } = useBranch();
  const { can } = usePermissions();
  const canManage = can("products:manage");
  const canUpload = can("uploads:auth") && canManage;
  const canImport = can("products:import");

  const getFilterParams = () => ({
    q: searchTerm.trim() || undefined,
    category: filterCategory || undefined,
    includeUnavailable: true,
  });

  const loadProducts = async (params?: { q?: string; category?: string }, nextPage?: number, nextLimit?: number) => {
    try {
      setPageLoading(true);
      const currentPage = nextPage ?? page;
      const currentLimit = nextLimit ?? limit;
      const data = await fetchProductsAdmin({ ...params, includeUnavailable: true, page: currentPage, limit: currentLimit });
      setProducts(data.items);
      setTotal(data.total);
      setHasMore(data.hasMore);
      setPage(data.page);
      setLimit(data.limit);
    } catch (err) {
      console.error(err);
    } finally {
      setPageLoading(false);
    }
  };

  const load = () => {
    loadProducts(getFilterParams(), 1, limit);
    fetchCategories().then(setCategories).catch(console.error);
  };

  useEffect(() => {
    if (!selectedBranchId) return;
    load();
  }, [selectedBranchId]);

  const applyFilters = () => {
    loadProducts(getFilterParams(), 1, limit);
  };

  const resetFilters = () => {
    setSearchTerm("");
    setFilterCategory("");
    loadProducts({ includeUnavailable: true } as any, 1, limit);
  };

  const openNewModal = () => {
    if (!canManage) return;
    setDraft({ images: [], categories: [], isAvailable: true });
    setFormError("");
    setCategorySearch("");
    setShowNewModal(true);
  };

  const closeNewModal = () => {
    setShowNewModal(false);
  };

  const openPriceModal = () => {
    if (!canManage) return;
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

  const openImportModal = () => {
    if (!canImport) return;
    setImportFile(null);
    setImportError("");
    setImportResult(null);
    setImportPreview(null);
    setImportSaving(false);
    setImportPreviewLoading(false);
    setImportDragActive(false);
    setImportPreviewProgress(0);
    setImportPreviewLoaded(0);
    setImportPreviewTotal(0);
    setImportPreviewStage(null);
    setImportShowOnlyChanges(true);
    importPreviewAbortRef.current?.abort();
    importPreviewAbortRef.current = null;
    setShowImportModal(true);
  };

  const closeImportModal = () => {
    if (importSaving) return;
    importPreviewAbortRef.current?.abort();
    importPreviewAbortRef.current = null;
    setShowImportModal(false);
  };

  const submitImport = async () => {
    if (!importFile) {
      setImportError(t("selectFile"));
      return;
    }
    setImportSaving(true);
    setImportError("");
    try {
      const result = await importProductsFromExcel(importFile);
      setImportResult(result);
      load();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Import failed";
      setImportError(msg);
    } finally {
      setImportSaving(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const getPageList = () => {
    if (totalPages <= 10) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const result: Array<number | "..."> = [];
    if (page < 5) {
      for (let i = 1; i <= 5; i += 1) result.push(i);
      result.push("...");
      result.push(totalPages - 1, totalPages);
      return result;
    }
    if (page > totalPages - 4) {
      result.push(1, 2);
      result.push("...");
      for (let i = totalPages - 4; i <= totalPages; i += 1) result.push(i);
      return result;
    }
    result.push(1, 2);
    result.push("...");
    result.push(page - 1, page, page + 1);
    result.push("...");
    result.push(totalPages - 1, totalPages);
    return result;
  };

  const loadImportPreview = async (file: File) => {
    importPreviewAbortRef.current?.abort();
    const controller = new AbortController();
    importPreviewAbortRef.current = controller;
    let wasCanceled = false;
    setImportPreviewLoading(true);
    setImportError("");
    setImportPreviewProgress(0);
    setImportPreviewLoaded(0);
    setImportPreviewTotal(0);
    setImportPreviewStage("upload");
    try {
      const preview = await previewProductsImport(file, controller.signal, ({ percent, loaded, total }) => {
        setImportPreviewProgress(Math.min(70, Math.round(percent * 0.7)));
        setImportPreviewLoaded(loaded);
        setImportPreviewTotal(total);
        if (percent >= 100) {
          setImportPreviewStage("processing");
        }
      });
      setImportPreview(preview);
    } catch (err: any) {
      if (err?.name === "CanceledError" || err?.code === "ERR_CANCELED") {
        wasCanceled = true;
      } else {
        const msg = err?.response?.data?.message || "Preview failed";
        setImportError(msg);
        setImportPreview(null);
      }
    } finally {
      if (wasCanceled || controller.signal.aborted) {
        importPreviewAbortRef.current = null;
        return;
      }
      setImportPreviewLoading(false);
      setImportPreviewProgress(100);
      setImportPreviewStage(null);
      importPreviewAbortRef.current = null;
    }
  };

  useEffect(() => {
    if (!importPreviewLoading || importPreviewStage !== "processing") {
      if (importPreviewTimerRef.current) {
        window.clearInterval(importPreviewTimerRef.current);
        importPreviewTimerRef.current = null;
      }
      return;
    }
    setImportPreviewProgress((prev) => Math.max(prev, 70));
    importPreviewTimerRef.current = window.setInterval(() => {
      setImportPreviewProgress((prev) => {
        if (prev >= 95) return prev;
        const bump = 2 + Math.floor(Math.random() * 4);
        return Math.min(95, prev + bump);
      });
    }, 400);
    return () => {
      if (importPreviewTimerRef.current) {
        window.clearInterval(importPreviewTimerRef.current);
        importPreviewTimerRef.current = null;
      }
    };
  }, [importPreviewLoading, importPreviewStage]);


  const isExcelFile = (file: File) => {
    const name = file.name.toLowerCase();
    return name.endsWith(".xlsx") || name.endsWith(".xls");
  };

  const formatFileSize = (size: number) => {
    if (size < 1024) return `${size} B`;
    const kb = size / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(2)} MB`;
  };

  const handleImportFile = (file: File | null) => {
    setImportError("");
    setImportResult(null);
    setImportPreview(null);
    setImportPreviewProgress(0);
    setImportPreviewLoaded(0);
    setImportPreviewTotal(0);
    setImportPreviewStage(null);
    importPreviewAbortRef.current?.abort();
    importPreviewAbortRef.current = null;
    if (!file) {
      setImportFile(null);
      return;
    }
    if (!isExcelFile(file)) {
      setImportFile(null);
      setImportError(t("invalidFileType") || "Only Excel files (.xlsx, .xls) are supported.");
      return;
    }
    setImportFile(file);
    loadImportPreview(file);
  };

  const handleImportDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setImportDragActive(true);
  };

  const handleImportDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setImportDragActive(false);
  };

  const handleImportDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setImportDragActive(false);
    const file = e.dataTransfer.files?.[0] || null;
    handleImportFile(file);
  };

  const formatPriceValue = (value: number | null | undefined) => {
    if (value === null || value === undefined || Number.isNaN(value)) return "-";
    return Number(value).toLocaleString();
  };

  const renderDiff = (current: string, previous?: string) => {
    if (!previous || previous === current) {
      return <span>{current || "-"}</span>;
    }
    return (
      <div className="import-diff">
        <span className="import-old">{previous}</span>
        <span className="import-arrow">-&gt;</span>
        <span className="import-new">{current}</span>
      </div>
    );
  };

  const renderPriceDiff = (current: number | null, previous?: number) => {
    if (previous === undefined || previous === null || previous === current) {
      return <span>{formatPriceValue(current)}</span>;
    }
    return (
      <div className="import-diff">
        <span className="import-old">{formatPriceValue(previous)}</span>
        <span className="import-arrow">-&gt;</span>
        <span className="import-new">{formatPriceValue(current)}</span>
      </div>
    );
  };

  const renderAvailabilityDiff = (current: boolean, previous?: boolean) => {
    const currentLabel = current ? t("available") : t("unavailable");
    if (previous === undefined || previous === current) {
      return <span>{currentLabel}</span>;
    }
    const previousLabel = previous ? t("available") : t("unavailable");
    return (
      <div className="import-diff">
        <span className="import-old">{previousLabel}</span>
        <span className="import-arrow">-&gt;</span>
        <span className="import-new">{currentLabel}</span>
      </div>
    );
  };

  const renderImportActionIcon = (action: string) => {
    if (action === "create") {
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 5a1 1 0 0 1 1 1v5h5a1 1 0 1 1 0 2h-5v5a1 1 0 1 1-2 0v-5H6a1 1 0 1 1 0-2h5V6a1 1 0 0 1 1-1z" />
        </svg>
      );
    }
    if (action === "update") {
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 13a6 6 0 0 0 10.95 3.1 1 1 0 1 1 1.7 1.05A8 8 0 1 1 6 9.6V7a1 1 0 0 1 2 0v4a1 1 0 0 1-1 1H3a1 1 0 1 1 0-2h3.6A6 6 0 0 0 6 13zM18 11a6 6 0 0 0-10.95-3.1 1 1 0 1 1-1.7-1.05A8 8 0 1 1 18 14.4V17a1 1 0 1 1-2 0v-4a1 1 0 0 1 1-1h4a1 1 0 1 1 0 2h-3.6A6 6 0 0 0 18 11z" />
        </svg>
      );
    }
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 12a1 1 0 0 1 1-1h10a1 1 0 1 1 0 2H7a1 1 0 0 1-1-1z" />
      </svg>
    );
  };

  const getImportReasonLabel = (reason?: string, reasonDetail?: string) => {
    if (!reason || reason === "undefined") return "-";
    if (reason === "updated_fields") {
      const fields = (reasonDetail || "")
        .split(",")
        .map((field) => field.trim())
        .filter(Boolean)
        .map((field) => t(`import.field.${field}`));
      if (fields.length === 0) return t("import.reason.updated_fields") || "Updated fields";
      return `${t("import.reason.updated_fields") || "Updated fields"}: ${fields.join(", ")}`;
    }
    const key = `import.reason.${reason}`;
    const label = t(key);
    return label === key ? "-" : label;
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
    if (!canManage) return;
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
    if (!canManage) return;
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
    if (!canManage) return;
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
    if (!canManage) return;
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
    if (!canManage) return;
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
    if (!canManage) return;
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
      <Card title={t("nav.products")} subTitle={`(${total})`}>
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
          <div className="flex" style={{ gap: 10 }}>
            <button className="ghost-btn" type="button" onClick={openPriceModal} disabled={!canManage}>
              {t("changePrices") || "Change prices"}
            </button>
            <button className="ghost-btn" type="button" onClick={openImportModal} disabled={!canImport}>
              {t("importProducts")}
            </button>
            <button className="primary" onClick={openNewModal} disabled={!canManage}>
              {t("addProduct")}
            </button>
          </div>
        </div>

        <div className="pagination" style={{ marginBottom: 15 }}>
          <div className="flex" style={{ alignItems: 'center', gap: 8 }}>
            {pageLoading && <img src="loading.gif" width="20" />}

            <button className="ghost-btn" disabled={page <= 1} onClick={() => loadProducts(getFilterParams(), page - 1, limit)}>
              {t("prev")}
            </button>

            <div className="page-number-row">
              {getPageList().map((p, idx) => (
                typeof p === "string" ? (
                  <span key={`ellipsis-${idx}`} className="page-ellipsis">…</span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    className={`page-btn${p === page ? " active" : ""}`}
                    onClick={() => loadProducts(getFilterParams(), p, limit)}
                    disabled={p === page || pageLoading}
                  >
                    {p}
                  </button>
                )
              ))}
            </div>


            <button className="ghost-btn" disabled={!hasMore} onClick={() => loadProducts(getFilterParams(), page + 1, limit)}>
              {t("next")}
            </button>
          </div>
          <div className="flex" style={{ alignItems: 'center', gap: 8 }}>
            <div className="muted">
              {/* {t("page")} {page} {t("of")} {totalPages} · {t("total")} {total} */}
              Showing
            </div>
            <select
              className="filter-select"
              value={limit}
              onChange={(e) => loadProducts(getFilterParams(), 1, Number(e.target.value))}
            >
              {[25, 50, 100, 200].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <div className="muted">
              {/* {t("page")} {page} {t("of")} {totalPages} · {t("total")} {total} */}
              per page
            </div>
          </div>
        </div>

        <table className="table" style={{ marginBottom: 15 }}>
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
                            disabled={editUploadingId === product._id || !canUpload}
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
                    ) : canManage ? (
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
                    ) : (
                      <div className="muted">{t("noPermissionAction")}</div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="pagination">
          <div className="flex" style={{ alignItems: 'center', gap: 8 }}>
            {pageLoading && <img src="loading.gif" width="20" />}

            <button className="ghost-btn" disabled={page <= 1} onClick={() => loadProducts(getFilterParams(), page - 1, limit)}>
              {t("prev")}
            </button>

            <div className="page-number-row">
              {getPageList().map((p, idx) => (
                typeof p === "string" ? (
                  <span key={`ellipsis-${idx}`} className="page-ellipsis">…</span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    className={`page-btn${p === page ? " active" : ""}`}
                    onClick={() => loadProducts(getFilterParams(), p, limit)}
                    disabled={p === page || pageLoading}
                  >
                    {p}
                  </button>
                )
              ))}
            </div>


            <button className="ghost-btn" disabled={!hasMore} onClick={() => loadProducts(getFilterParams(), page + 1, limit)}>
              {t("next")}
            </button>
          </div>
          <div className="flex" style={{ alignItems: 'center', gap: 8 }}>
            <div className="muted">
              {/* {t("page")} {page} {t("of")} {totalPages} · {t("total")} {total} */}
              Showing
            </div>
            <select
              className="filter-select"
              value={limit}
              onChange={(e) => loadProducts(getFilterParams(), 1, Number(e.target.value))}
            >
              {[25, 50, 100, 200].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <div className="muted">
              {/* {t("page")} {page} {t("of")} {totalPages} · {t("total")} {total} */}
              per page
            </div>
          </div>
        </div>
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

      {showPromoteModal && promoteProduct && canManage && (
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

      {showNewModal && canManage && (
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

      {showPriceModal && canManage && (
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

      {showImportModal && canImport && (
        <div className="modal-backdrop" onClick={closeImportModal}>
          <div className="modal import-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{t("importProducts")}</div>
              <button className="ghost-btn" type="button" onClick={closeImportModal}>
                {t("close")}
              </button>
            </div>
            <div className="form">
              <div className="muted">{t("importProductsHint")}</div>
              <div className="import-upload">
                {importFile ? (
                  <div className="import-file-card">
                    <div className="import-file-details">
                      <div>
                        <div className="import-file-name">{importFile.name}</div>
                        <div className="import-file-size">{formatFileSize(importFile.size)}</div>
                      </div>
                      <div className="import-file-actions">
                        {importPreviewLoading ? (
                          <>
                            <div className="import-loading">
                              <div className="import-progress" style={{ marginBottom: 5 }}>
                                <div className="import-progress-bar" style={{ width: `${importPreviewProgress}%` }} />
                              </div>

                              <div className="import-file-size" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <img src="loading.gif" className="noFilter" width="15" />
                                {importPreviewStage === "processing"
                                  ? t("loadingPreview")
                                  : `${t("upload") || "Uploading"}...`}
                              </div>

                              {/* {importPreviewTotal > 0 && (
                                <div className="muted import-progress-meta">
                                  {formatFileSize(importPreviewLoaded)} / {formatFileSize(importPreviewTotal)}
                                </div>
                              )} */}
                            </div>
                            <button
                              className="ghost-btn"
                              type="button"
                              onClick={() => {
                                importPreviewAbortRef.current?.abort();
                                importPreviewAbortRef.current = null;
                                setImportPreviewLoading(false);
                                setImportPreviewProgress(0);
                                setImportPreviewLoaded(0);
                                setImportPreviewTotal(0);
                                setImportPreviewStage(null);
                                setImportFile(null);
                                setImportPreview(null);
                                setImportResult(null);
                                setImportError("");
                              }}
                            >
                              {t("cancel") || "Cancel"}
                            </button>
                          </>
                        ) : (
                          <button
                            className="ghost-btn"
                            type="button"
                            onClick={() => {
                              setImportFile(null);
                              setImportPreview(null);
                              setImportResult(null);
                              setImportError("");
                              setImportPreviewProgress(0);
                              setImportPreviewLoaded(0);
                              setImportPreviewTotal(0);
                              setImportPreviewStage(null);
                              importPreviewAbortRef.current?.abort();
                              importPreviewAbortRef.current = null;
                            }}
                          >
                            {t("remove") || "Remove"}
                          </button>
                        )}
                      </div>

                    </div>
                  </div>
                ) : (
                  <div
                    className={`import-dropzone${importDragActive ? " active" : ""}${importFile ? " has-file" : ""}`}
                    onDragOver={handleImportDragOver}
                    onDragEnter={handleImportDragOver}
                    onDragLeave={handleImportDragLeave}
                    onDrop={handleImportDrop}
                  >
                    <input
                      id="importExcelFile"
                      type="file"
                      accept=".xlsx,.xls"
                      className="import-file-input"
                      onChange={(e) => handleImportFile(e.target.files?.[0] || null)}
                    />
                    <label htmlFor="importExcelFile" className="import-dropzone-inner">
                      <div className="import-icon">
                        <img src="uploadIcon.png" alt="" />
                      </div>
                      {/* <div className="import-title">{t("selectFile") || "Select file"}</div> */}
                      <div className="import-sub">Drag & drop your Excel file here, or click to browse.</div>
                      <div className="import-meta muted">Allowed extensions: .xlsx or .xls</div>
                    </label>
                  </div>
                )}
              </div>
              {importError && <div className="error">{importError}</div>}
              {importPreview && !importPreviewLoading && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                      <div className="modal-title">
                        {t("importPreviewSummaryPrefix")}
                      </div>
                      <div className="success">
                        {t("importPreviewSummary")
                          .replace("{created}", String(importPreview.created))
                          .replace("{updated}", String(importPreview.updated))
                          .replace("{skipped}", String(importPreview.skipped))
                          .replace("{total}", String(importPreview.total))}
                      </div>
                    </div>
                    <div className="import-preview-controls">
                      <label className="checkboxContainer" style={{ margin: 0 }}>
                        <input
                          id="importShowOnlyChanges"
                          type="checkbox"
                          checked={importShowOnlyChanges}
                          onChange={(e) => setImportShowOnlyChanges(e.target.checked)}
                        />
                        <label htmlFor="importShowOnlyChanges" style={{ cursor: 'pointer', fontSize: '12px', margin: 0, fontWeight: '400' }}>
                          {t("showChangesOnly") || "Show only changes"}
                        </label>
                      </label>
                    </div>
                  </div>
                  <table className="table" style={{ marginTop: 10 }}>
                    <thead>
                      <tr>
                        <th></th>
                        <th>{t("name")}</th>
                        <th>{t("price")}</th>
                        <th>{t("availability")}</th>
                        <th>{t("change")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.preview
                        .filter((row) => (importShowOnlyChanges ? row.action !== "skip" : true))
                        .map((row, idx) => (
                          <tr key={`${row.barcode}-${idx}`}>
                            <td>
                              <span className={`import-change-badge ${row.action}`} title={t(`import.action.${row.action}`)}>
                                {renderImportActionIcon(row.action)}
                              </span>
                            </td>
                            <td>{renderDiff(row.name, row.previousName)}</td>
                            <td>{renderPriceDiff(row.price, row.previousPrice)}</td>
                            <td>{renderAvailabilityDiff(row.hasStock, row.previousHasStock)}</td>
                            <td>{getImportReasonLabel(row.reason, row.reasonDetail)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </>
              )}
              {importResult && (
                <div className="success" style={{ marginTop: 10 }}>
                  {t("importSummary")
                    .replace("{created}", String(importResult.created))
                    .replace("{updated}", String(importResult.updated))
                    .replace("{skipped}", String(importResult.skipped))
                    .replace("{total}", String(importResult.total))}
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button className="ghost-btn" type="button" onClick={closeImportModal} disabled={importSaving}>
                {t("cancel")}
              </button>
              <button className="primary" type="button" onClick={submitImport} disabled={importSaving || !importPreview}>
                {importSaving ? t("saving") : t("import")}
              </button>
            </div>
          </div>
        </div >
      )}
    </>
  );
};

export default ProductsPage;
