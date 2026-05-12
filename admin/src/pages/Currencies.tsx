import { useEffect, useState } from "react";
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
    if (!canManage) return;
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
    if (!window.confirm(t("confirmDeleteCurrency") || "Delete this currency?")) return;
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
            <button className="ghost-btn" type="submit">
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
                    {editingId === currency._id ? (
                      <div className="flex">
                        <input
                          value={editDraft.symbol?.en || ""}
                          placeholder={t("symbolEn") || "English symbol"}
                          onChange={(e) => setEditDraft({ ...editDraft, symbol: { ...editDraft.symbol, en: e.target.value } })}
                        />
                        <input
                          value={editDraft.symbol?.ar || ""}
                          placeholder={t("symbolAr") || "Arabic symbol"}
                          onChange={(e) => setEditDraft({ ...editDraft, symbol: { en: editDraft.symbol?.en || "", ar: e.target.value } })}
                        />
                      </div>
                    ) : (
                      getCurrencySymbol(currency, lang, t) || "-"
                    )}
                  </td>
                  <td>
                    {editingId === currency._id && !currency.isPrimary ? (
                      <input
                        type="number"
                        min="0"
                        step="0.0001"
                        value={editDraft.exchangeRate ?? ""}
                        onChange={(e) => setEditDraft({ ...editDraft, exchangeRate: Number(e.target.value) })}
                      />
                    ) : (
                      renderRate(currency)
                    )}
                  </td>
                  <td>
                    {editingId === currency._id ? (
                      <div className="checkboxContainer">
                        <input
                          id={`currencyPrimary${currency._id}`}
                          type="checkbox"
                          checked={Boolean(editDraft.isPrimary)}
                          onChange={(e) => setEditDraft({ ...editDraft, isPrimary: e.target.checked })}
                        />
                        <label htmlFor={`currencyPrimary${currency._id}`}></label>
                      </div>
                    ) : currency.isPrimary ? (
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
                    {editingId === currency._id && !currency.isPrimary ? (
                      <div className="checkboxContainer">
                        <input
                          id={`currencyActive${currency._id}`}
                          type="checkbox"
                          checked={editDraft.isActive !== false}
                          onChange={(e) => setEditDraft({ ...editDraft, isActive: e.target.checked })}
                        />
                        <label htmlFor={`currencyActive${currency._id}`}></label>
                      </div>
                    ) : currency.isActive ? (
                      t("yes") || "Yes"
                    ) : (
                      t("no") || "No"
                    )}
                  </td>
                  <td>
                    {editingId === currency._id ? (
                      <div className="flex">
                        <button className="ghost-btn" type="button" onClick={saveEdit} disabled={saving}>
                          {t("save")}
                        </button>
                        <button className="ghost-btn" type="button" onClick={cancelEdit} disabled={saving}>
                          {t("cancel")}
                        </button>
                      </div>
                    ) : canManage ? (
                      <div className="flex">
                        <button className="ghost-btn" type="button" onClick={() => startEdit(currency)}>
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

      {showNewModal && canManage && (
        <div className="modal-backdrop" onClick={closeNewModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{t("newCurrency") || "New currency"}</div>
              <button className="ghost-btn" type="button" onClick={closeNewModal}>
                {t("close")}
              </button>
            </div>
            <form className="form" onSubmit={submitNew}>
              <label>
                {t("symbolEn") || "English symbol"}
                <input
                  value={draft.symbol?.en || ""}
                  onChange={(e) => setDraft({ ...draft, symbol: { ...draft.symbol, en: e.target.value } })}
                />
              </label>
              <label>
                {t("symbolAr") || "Arabic symbol"}
                <input
                  value={draft.symbol?.ar || ""}
                  onChange={(e) => setDraft({ ...draft, symbol: { en: draft.symbol?.en || "", ar: e.target.value } })}
                />
              </label>
              <label>
                {t("exchangeRate") || "Exchange rate"}
                <input
                  type="number"
                  min="0"
                  step="0.0001"
                  value={draft.exchangeRate ?? ""}
                  onChange={(e) => setDraft({ ...draft, exchangeRate: Number(e.target.value) })}
                  disabled={Boolean(draft.isPrimary)}
                />
              </label>
              <div className="checkboxContainer">
                <input
                  id="newCurrencyPrimary"
                  type="checkbox"
                  checked={Boolean(draft.isPrimary)}
                  onChange={(e) => setDraft({ ...draft, isPrimary: e.target.checked, exchangeRate: e.target.checked ? 1 : draft.exchangeRate })}
                />
                <label htmlFor="newCurrencyPrimary">{t("primaryCurrency") || "Primary"}</label>
              </div>
              <div className="checkboxContainer">
                <input
                  id="newCurrencyActive"
                  type="checkbox"
                  checked={draft.isActive !== false}
                  onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
                  disabled={Boolean(draft.isPrimary)}
                />
                <label htmlFor="newCurrencyActive">{t("active")}</label>
              </div>
              {error && <div className="error">{error}</div>}
              <div className="modal-actions">
                <button className="ghost-btn" type="button" onClick={closeNewModal} disabled={saving}>
                  {t("cancel")}
                </button>
                <button className="primary" type="submit" disabled={saving}>
                  {saving ? (t("saving") || "Saving...") : t("save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default CurrenciesPage;
