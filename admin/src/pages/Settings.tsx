import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Card from "../components/Card";
import type { Currency, Settings } from "../types/api";
import { fetchCurrencies, fetchSettings, updateSettings } from "../api/client";
import { useI18n } from "../context/I18nContext";
import { usePermissions } from "../hooks/usePermissions";
import { useBranch } from "../context/BranchContext";

const SettingsPage = () => {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const { t, lang } = useI18n();
  const { can } = usePermissions();
  const { selectedBranchId } = useBranch();
  const canManage = can("settings:manage");

  useEffect(() => {
    if (!selectedBranchId) return;
    setLoading(true);
    Promise.all([fetchSettings(), fetchCurrencies()])
      .then(([settingsData, currencyData]) => {
        setSettings(settingsData);
        setCurrencies(currencyData.filter((currency) => currency.isActive));
      })
      .finally(() => setLoading(false));
  }, [selectedBranchId]);

  if (loading || !settings) {
    return (
      <>
        <Card title={t("settings.operational")} subTitle="">
          <div className="form">
            {Array.from({ length: 6 }).map((_, idx) => (
              <label key={`skeleton-${idx}`}>
                <span className="skeleton-line w-140" />
                <span className="skeleton-line w-180" />
              </label>
            ))}
          </div>
        </Card>
        <Card title={t("settings.membership")} subTitle="">
          <div className="form">
            {Array.from({ length: 6 }).map((_, idx) => (
              <label key={`skeleton-m-${idx}`}>
                <span className="skeleton-line w-140" />
                <span className="skeleton-line w-180" />
              </label>
            ))}
          </div>
        </Card>
      </>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canManage) return;
    if (saving) return;
    setSaving(true);
    try {
      const res = await updateSettings(settings);
      setSettings(res);
    } finally {
      setSaving(false);
    }
  };

  const updateField = (key: keyof Settings, value: number) => setSettings({ ...settings, [key]: value });
  const updateToggle = (key: keyof Settings, value: boolean) => setSettings({ ...settings, [key]: value });
  const getCurrencySymbol = (currency: Currency) => {
    const localized = currency.symbol?.[lang] || currency.symbol?.en || currency.symbol?.ar || "";
    if (lang === "ar" && localized.toLowerCase?.() === currency.symbol?.en?.toLowerCase?.()) {
      const translated = t(`currencySymbol.${currency.symbol.en.toUpperCase()}`);
      if (translated !== `currencySymbol.${currency.symbol.en.toUpperCase()}`) return translated;
    }
    return localized;
  };
  const getCurrencyThresholds = (currency: Currency) => {
    const match = settings.membershipThresholdsByCurrency?.find((entry) => {
      const entryCurrency = entry.currency;
      const entryCurrencyId = typeof entryCurrency === "string" ? entryCurrency : entryCurrency?._id;
      return entryCurrencyId === currency._id;
    });
    if (match?.thresholds) return match.thresholds;
    if (currency.isPrimary) return settings.membershipThresholds;
    const rate = Number(currency.exchangeRate || 1);
    return {
      silver: Math.round(settings.membershipThresholds.silver / rate),
      gold: Math.round(settings.membershipThresholds.gold / rate),
      platinum: Math.round(settings.membershipThresholds.platinum / rate),
      diamond: Math.round(settings.membershipThresholds.diamond / rate),
    };
  };
  const updateCurrencyThreshold = (currency: Currency, level: "silver" | "gold" | "platinum" | "diamond", value: number) => {
    const existing = settings.membershipThresholdsByCurrency || [];
    const current = getCurrencyThresholds(currency);
    const nextEntry = { currency: currency._id, thresholds: { ...current, [level]: value } };
    const next = existing.some((entry) => {
      const entryCurrency = entry.currency;
      const entryCurrencyId = typeof entryCurrency === "string" ? entryCurrency : entryCurrency?._id;
      return entryCurrencyId === currency._id;
    })
      ? existing.map((entry) => {
        const entryCurrency = entry.currency;
        const entryCurrencyId = typeof entryCurrency === "string" ? entryCurrency : entryCurrency?._id;
        return entryCurrencyId === currency._id ? nextEntry : entry;
      })
      : [...existing, nextEntry];
    const nextSettings = { ...settings, membershipThresholdsByCurrency: next };
    if (currency.isPrimary) {
      nextSettings.membershipThresholds = { ...settings.membershipThresholds, [level]: value };
    }
    setSettings(nextSettings);
  };

  return (
    <>
      <form className="form" onSubmit={submit}>
        <Card title={t("settings.operational")} subTitle="">
          <label>
            {t("deliveryFreeKm")}
            <input
              type="number"
              value={settings.deliveryFreeKm}
              onChange={(e) => updateField("deliveryFreeKm", Number(e.target.value))}
              disabled={!canManage}
            />
          </label>
          <label>
            {t("deliveryRatePerKm")}
            <input
              type="number"
              value={settings.deliveryRatePerKm}
              onChange={(e) => updateField("deliveryRatePerKm", Number(e.target.value))}
              disabled={!canManage}
            />
          </label>
          <div className="checkboxContainer">
            <input
              id="allowMultipleCoupons"
              type="checkbox"
              checked={settings.allowMultipleCoupons}
              onChange={(e) => updateToggle("allowMultipleCoupons", e.target.checked)}
              disabled={!canManage}
            />
            <label htmlFor="allowMultipleCoupons">{t("allowMultipleCoupons")}</label>
          </div>
          <label>
            {t("membershipGraceDays")}
            <input
              type="number"
              value={settings.membershipGraceDays}
              onChange={(e) => updateField("membershipGraceDays", Number(e.target.value))}
              disabled={!canManage}
            />
          </label>
        </Card>

        <Card title={t("settings.membership")} subTitle="">
          <div className="thresholds">
            <label>{t("levelsLabel")}</label>
            {currencies.map((currency) => {
              const thresholds = getCurrencyThresholds(currency);
              return (
                <div className="card" key={currency._id} style={{ marginBottom: 12 }}>
                  <div className="form-title">
                    {getCurrencySymbol(currency)} {currency.isPrimary ? `(${t("primary") || "Primary"})` : ""}
                  </div>
                  <div className="grid row">
                    {(["silver", "gold", "platinum", "diamond"] as const).map((level) => (
                      <label key={`${currency._id}-${level}`}>
                        <span className="subLabel">{t(`level.${level}`)}</span>
                        <input
                          type="number"
                          value={thresholds[level]}
                          onChange={(e) => updateCurrencyThreshold(currency, level, Number(e.target.value))}
                          disabled={!canManage}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <label>
            {t("pointsPerAmount")}
            <input
              type="number"
              value={settings.pointsPerAmount}
              onChange={(e) => updateField("pointsPerAmount", Number(e.target.value))}
              disabled={!canManage}
            />
          </label>
          <label>
            {t("rewardThresholdPoints")}
            <input
              type="number"
              value={settings.rewardThresholdPoints}
              onChange={(e) => updateField("rewardThresholdPoints", Number(e.target.value))}
              disabled={!canManage}
            />
          </label>
          <label>
            {t("rewardValue")}
            <input
              type="number"
              value={settings.rewardValue}
              onChange={(e) => updateField("rewardValue", Number(e.target.value))}
              disabled={!canManage}
            />
          </label>
        </Card>

        {canManage && (
          <button className="primary" disabled={saving}>
            {saving ? (t("saving") || "Saving...") : t("saveSettings")}
          </button>
        )}
      </form>
    </>
  );
};

export default SettingsPage;
