import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Card from "../components/Card";
import type { Settings } from "../types/api";
import { fetchSettings, updateSettings } from "../api/client";
import { useI18n } from "../context/I18nContext";
import { usePermissions } from "../hooks/usePermissions";
import { useBranch } from "../context/BranchContext";

const SettingsPage = () => {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const { t } = useI18n();
  const { can } = usePermissions();
  const { selectedBranchId } = useBranch();
  const canManage = can("settings:manage");

  useEffect(() => {
    if (!selectedBranchId) return;
    setLoading(true);
    fetchSettings()
      .then(setSettings)
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

  return (
    <>
      <form className="form" onSubmit={submit}>
        <Card title={t("settings.operational")} subTitle="">
          <label>
            {t("storeLat")}
            <input
              type="number"
              value={settings.storeLat}
              onChange={(e) => updateField("storeLat", Number(e.target.value))}
              disabled={!canManage}
            />
          </label>
          <label>
            {t("storeLng")}
            <input
              type="number"
              value={settings.storeLng}
              onChange={(e) => updateField("storeLng", Number(e.target.value))}
              disabled={!canManage}
            />
          </label>
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
          <label className="thresholds">
            <label>{t("levelsLabel")}</label>
            <div className="grid row">
              {(["silver", "gold", "platinum", "diamond"] as const).map((level) => (
                <label key={level}>
                  <span className="subLabel">{t(`level.${level}`)}</span>
                  <input
                    type="number"
                    value={settings.membershipThresholds[level]}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        membershipThresholds: { ...settings.membershipThresholds, [level]: Number(e.target.value) },
                      })
                    }
                    disabled={!canManage}
                  />
                </label>
              ))}
            </div>
          </label>

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
