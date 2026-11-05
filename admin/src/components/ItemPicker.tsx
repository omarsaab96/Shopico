import { useId } from "react";
import { useI18n } from "../context/I18nContext";

type Item = { _id: string; name: string; description?: string };

type Props = {
  items: Item[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  multiple?: boolean;
  loading?: boolean;
};

export default function ItemPicker({ items, selectedIds, onChange, search, onSearchChange, searchPlaceholder, multiple = true, loading = false }: Props) {
  const id = useId();
  const { t } = useI18n();
  const term = search.trim().toLowerCase();
  const filtered = items.filter(item => !term || item.name.toLowerCase().includes(term) || item.description?.toLowerCase().includes(term));
  return <div className="multi-select" aria-busy={loading}>
    <div className="flex">
      <div className="multiSelectSearch">
        <input className="filter-input" aria-label={searchPlaceholder} placeholder={searchPlaceholder} value={search} onChange={event => onSearchChange(event.target.value)} />
        {search && <button className="clearSearchBtn" type="button" aria-label={t("clear")} title={t("clear")} onClick={() => onSearchChange("")} />}
      </div>
      <div className="multi-select-actions">
        {multiple && <button className="ghost-btn" type="button" disabled={loading} onClick={() => onChange(selectedIds.length === items.length ? [] : items.map(item => item._id))}>
          {t(selectedIds.length === items.length ? "clearAll" : "selectAll")}
        </button>}
        {selectedIds.length > 0 && <div className="multi-select-count">{t("selected")}: {selectedIds.length}</div>}
      </div>
    </div>
    <div className="multi-select-list">
      {loading ? <div className="muted">{t("loading")}</div> : filtered.length === 0 ? <div className="muted">{t("noResults")}</div> : filtered.map(item => {
        const checked = selectedIds.includes(item._id);
        return <div key={item._id} className="checkboxContainer multi-select-item">
          <input id={`${id}-${item._id}`} name={id} type={multiple ? "checkbox" : "radio"} checked={checked}
            onChange={() => onChange(multiple ? checked ? selectedIds.filter(selected => selected !== item._id) : [...selectedIds, item._id] : [item._id])} />
          <label htmlFor={`${id}-${item._id}`}>{item.name}</label>
        </div>;
      })}
    </div>
  </div>;
}
