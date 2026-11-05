import { confirmAction } from "../utils/confirmation";
import ModalSurface from "../components/ModalSurface";
import { useEffect, useId, useState } from "react";
import type { FormEvent } from "react";
import Card from "../components/Card";
import type { Currency } from "../types/api";
import { deleteCurrency, fetchCurrencies, saveCurrency } from "../api/client";
import { useBranch } from "../context/BranchContext";
import { useI18n } from "../context/I18nContext";
import { usePermissions } from "../hooks/usePermissions";

const emptyDraft: Partial<Currency> = {
  symbol: { en: "", ar: "" },
  exchangeRate: 1,
  isPrimary: false,
  isActive: true,
};

const normalizeDraft = (draft: Partial<Currency>) => ({
  symbol: {
    en: (draft.symbol?.en || "").trim(),
    ar: draft.symbol?.ar?.trim() || undefined,
  },
  exchangeRate: Number(draft.exchangeRate || 0),
  isPrimary: Boolean(draft.isPrimary),
  isActive: draft.isActive !== false,
});

const getCurrencySymbol = (currency: Currency, lang: "en" | "ar", t: (key: string) => string) => {
  const symbol = currency.symbol as Currency["symbol"] | string;
  const en = typeof symbol === "string" ? symbol : symbol.en;
  const localized = typeof symbol === "string" ? "" : symbol[lang];
  if (lang === "ar" && (!localized || localized.toLowerCase() === en.toLowerCase())) {
    const key = `currencySymbol.${en.toUpperCase()}`;
    const translated = t(key);
    if (translated !== key) return translated;
  }
  return localized || en;
};

const CurrenciesPage = () => {
  const editorFormId = useId();
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [draft, setDraft] = useState<Partial<Currency>>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<Currency>>({});
  const [showNewModal, setShowNewModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { selectedBranchId } = useBranch();
  const { t, lang } = useI18n();
  const { can } = usePermissions();
  const canManage = can("currencies:manage");

  const getFilterParams = () => ({
    q: searchTerm.trim() || undefined,
  });

  const load = async (params?: { q?: string }) => {
    setLoading(true);
    try {
      const data = await fetchCurrencies(params ?? getFilterParams());
      setCurrencies(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedBranchId) return;
    load();
  }, [selectedBranchId]);

  const applyFilters = () => load(getFilterParams());

  const resetFilters = () => {
    setSearchTerm("");
    load({});
  };

  const openNewModal = () => {
    if (!canManage || saving) return;
    cancelEdit();
    setDraft({ ...emptyDraft, isPrimary: currencies.length === 0 });
    setError("");
    setShowNewModal(true);
  };

  const closeNewModal = () => {
    setShowNewModal(false);
    setDraft(emptyDraft);
    setError("");
  };

  const submitNew = async (e: FormEvent) => {
    e.preventDefault();
    if (!canManage || saving) return;
    setSaving(true);
    setError("");
    try {
      await saveCurrency(normalizeDraft(draft));
      closeNewModal();
      await load(getFilterParams());
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Could not save currency");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (currency: Currency) => {
    if (!canManage) return;
    setShowNewModal(false);
    setEditingId(currency._id);
    setEditDraft(currency);
    setError("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft({});
    setError("");
  };

  const saveEdit = async () => {
    if (!editingId || !canManage || saving) return;
    setSaving(true);
    setError("");
    try {
      await saveCurrency({ _id: editingId, ...normalizeDraft(editDraft) });
      cancelEdit();
      await load(getFilterParams());
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Could not update currency");
    } finally {
      setSaving(false);
    }
  };

  const removeCurrency = async (currency: Currency) => {
    if (!canManage) return;
    if (!(await confirmAction({ danger: true, title: t("delete"), message: t("confirmDeleteCurrency") || "Delete this currency?", confirmLabel: t("delete"), cancelLabel: t("cancel") }))) return;
    setError("");
    try {
      await deleteCurrency(currency._id);
      await load(getFilterParams());
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Could not delete currency");
    }
  };

  const setPrimary = async (currency: Currency) => {
    if (!canManage || currency.isPrimary) return;
    setError("");
    try {
      await saveCurrency({ _id: currency._id, isPrimary: true });
      await load(getFilterParams());
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Could not set primary currency");
    }
  };

  const renderRate = (currency: Currency) => {
    const symbol = getCurrencySymbol(currency, lang, t);
    if (currency.isPrimary) return `1 ${symbol}`;
    const primary = currencies.find((item) => item.isPrimary);
    const primarySymbol = primary ? getCurrencySymbol(primary, lang, t) : t("primaryCurrency") || "Primary";
    return `1 ${symbol} = ${currency.exchangeRate.toLocaleString()} ${primarySymbol}`;
  };

  const modalDraft = editingId ? editDraft : draft;
  const setModalDraft = editingId ? setEditDraft : setDraft;
  const closeEditor = () => { if (saving) return; cancelEdit(); closeNewModal(); };

  return (
    <>
      <Card title={t("nav.currencies") || "Currencies"} subTitle={`(${currencies.length})`}>
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
              placeholder={t("searchCurrencies") || "Search symbol"}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button className="primary" type="submit">
              {t("filter")}
            </button>
            <button className="ghost-btn" type="button" onClick={resetFilters}>
              {t("clear")}
            </button>
          </form>
          {canManage && (
            <button className="primary" type="button" onClick={openNewModal}>
              {t("addCurrency") || "Add currency"}
            </button>
          )}
        </div>

        {error && <div className="error">{error}</div>}

        <table className="table">
          <thead>
            <tr>
              <th>{t("symbol") || "Symbol"}</th>
              <th>{t("exchangeRate") || "Exchange rate"}</th>
              <th>{t("primaryCurrency") || "Primary"}</th>
              <th>{t("active")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <tr key={`skeleton-${idx}`} className="productRow">
                  <td><span className="skeleton-line w-80" /></td>
                  <td><span className="skeleton-line w-180" /></td>
                  <td><span className="skeleton-line w-80" /></td>
                  <td><span className="skeleton-line w-80" /></td>
                  <td><span className="skeleton-line w-120" /></td>
                </tr>
              ))
            ) : currencies.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted">{t("noCurrencies") || "No currencies"}</td>
              </tr>
            ) : (
              currencies.map((currency) => (
                <tr key={currency._id} className="productRow">
                  <td>
                    {(
                      getCurrencySymbol(currency, lang, t) || "-"
                    )}
                  </td>
                  <td>
                    {(
                      renderRate(currency)
                    )}
                  </td>
                  <td>
                    {currency.isPrimary ? (
                      t("yes") || "Yes"
                    ) : canManage ? (
                      <button className="ghost-btn" type="button" onClick={() => setPrimary(currency)}>
                        {t("setPrimary") || "Set primary"}
                      </button>
                    ) : (
                      t("no") || "No"
                    )}
                  </td>
                  <td>
                    {currency.isActive ? (
                      t("yes") || "Yes"
                    ) : (
                      t("no") || "No"
                    )}
                  </td>
                  <td>
                    {canManage ? (
                      <div className="flex">
                        <button className="primary" type="button" onClick={() => startEdit(currency)}>
                          {t("edit")}
                        </button>
                        <button
                          className="ghost-btn danger"
                          type="button"
                          onClick={() => removeCurrency(currency)}
                          disabled={currency.isPrimary}
                        >
                          {t("delete")}
                        </button>
                      </div>
                    ) : (
                      <span className="muted">-</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      {(showNewModal || editingId) && canManage && (
        <div className="modal-backdrop" onClick={closeEditor}>
          <ModalSurface className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{t(editingId ? "editCurrency" : "newCurrency") || "New currency"}</div>
              <button className="ghost-btn" type="button" onClick={closeEditor} disabled={saving}>
                {t("close")}
              </button>
            </div>
            <form id={editorFormId} className="form" onSubmit={editingId ? event => { event.preventDefault(); void saveEdit(); } : submitNew}>
              <label>
                {t("symbolEn") || "English symbol"}
                <input
                  autoFocus
                  required
                  maxLength={12}
                  pattern={".*\\S.*"}
                  value={modalDraft.symbol?.en || ""}
                  onChange={(e) => setModalDraft({ ...modalDraft, symbol: { ...modalDraft.symbol, en: e.target.value } })}
                />
              </label>
              <label>
                {t("symbolAr") || "Arabic symbol"}
                <input
                  maxLength={12}
                  value={modalDraft.symbol?.ar || ""}
                  onChange={(e) => setModalDraft({ ...modalDraft, symbol: { en: modalDraft.symbol?.en || "", ar: e.target.value } })}
                />
              </label>
              <label>
                {t("exchangeRate") || "Exchange rate"}
                <input
                  type="number"
                  required
                  min="0.0001"
                  step="0.0001"
                  value={modalDraft.exchangeRate ?? ""}
                  onChange={(e) => setModalDraft({ ...modalDraft, exchangeRate: Number(e.target.value) })}
                  disabled={Boolean(modalDraft.isPrimary)}
                />
              </label>
              <div className="checkboxContainer">
                <input
                  id="newCurrencyPrimary"
                  type="checkbox"
                  checked={Boolean(modalDraft.isPrimary)}
                  onChange={(e) => setModalDraft({ ...modalDraft, isPrimary: e.target.checked, exchangeRate: e.target.checked ? 1 : modalDraft.exchangeRate })}
                />
                <label htmlFor="newCurrencyPrimary">{t("primaryCurrency") || "Primary"}</label>
              </div>
              <div className="checkboxContainer">
                <input
                  id="newCurrencyActive"
                  type="checkbox"
                  checked={modalDraft.isActive !== false}
                  onChange={(e) => setModalDraft({ ...modalDraft, isActive: e.target.checked })}
                  disabled={Boolean(modalDraft.isPrimary)}
                />
                <label htmlFor="newCurrencyActive">{t("active")}</label>
              </div>
              {error && <div className="error">{error}</div>}

            </form>
            <div className="modal-actions">
              <button className="ghost-btn" type="button" onClick={closeEditor} disabled={saving}>
                {t("cancel")}
              </button>
                <button className="primary" type="submit" form={editorFormId} disabled={saving}>
                {saving ? (t("saving") || "Saving...") : t("save")}
              </button>
            </div>
          </ModalSurface>
        </div>
      )}
    </>
  );
};

export default CurrenciesPage;
