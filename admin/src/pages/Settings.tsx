import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Card from "../components/Card";
import type { Settings } from "../types/api";
import { fetchSettings, updateSettings } from "../api/client";

const SettingsPage = () => {
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    fetchSettings().then(setSettings);
  }, []);

  if (!settings) return <div>Loading settings...</div>;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const res = await updateSettings(settings);
    setSettings(res);
  };

  const updateField = (key: keyof Settings, value: number) => setSettings({ ...settings, [key]: value });

  return (
    <>
      <form className="form" onSubmit={submit}>
        <Card title="Operational Settings" subTitle="">
          <label>
            Store latitude
            <input type="number" value={settings.storeLat} onChange={(e) => updateField("storeLat", Number(e.target.value))} />
          </label>
          <label>
            Store longitude
            <input type="number" value={settings.storeLng} onChange={(e) => updateField("storeLng", Number(e.target.value))} />
          </label>
          <label>
            Free delivery distance (Km)
            <input
              type="number"
              value={settings.deliveryFreeKm}
              onChange={(e) => updateField("deliveryFreeKm", Number(e.target.value))}
            />
          </label>
          <label>
            Delivery rate per Km (SYP)
            <input
              type="number"
              value={settings.deliveryRatePerKm}
              onChange={(e) => updateField("deliveryRatePerKm", Number(e.target.value))}
            />
          </label>
          <label>
            Membership grace days
            <input
              type="number"
              value={settings.membershipGraceDays}
              onChange={(e) => updateField("membershipGraceDays", Number(e.target.value))}
            />
          </label>
        </Card>

        <Card title="Membership Settings" subTitle="">
          <label className="thresholds">
            <label>Levels (SYP)</label>
            <div className="grid row">
              {(["silver", "gold", "platinum", "diamond"] as const).map((level) => (
                <label key={level}>
                  <span className="subLabel">{level}</span>
                  <input
                    type="number"
                    value={settings.membershipThresholds[level]}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        membershipThresholds: { ...settings.membershipThresholds, [level]: Number(e.target.value) },
                      })
                    }
                  />
                </label>
              ))}
            </div>
          </label>

          <label>
            Point cost (SYP per point)
            <input
              type="number"
              value={settings.pointsPerAmount}
              onChange={(e) => updateField("pointsPerAmount", Number(e.target.value))}
            />
          </label>
          <label>
            Reward threshold (points)
            <input
              type="number"
              value={settings.rewardThresholdPoints}
              onChange={(e) => updateField("rewardThresholdPoints", Number(e.target.value))}
            />
          </label>
          <label>
            Reward value (SYP)
            <input
              type="number"
              value={settings.rewardValue}
              onChange={(e) => updateField("rewardValue", Number(e.target.value))}
            />
          </label>
        </Card>

        <button className="primary">Save Settings</button>
      </form>
    </>
  );
};

export default SettingsPage;
