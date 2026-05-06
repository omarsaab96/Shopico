import { Settings } from "../models/Settings";
import { recalculateMembershipsForThresholdChange } from "../utils/membership";

const normalizeThresholds = (thresholds: any) => ({
  silver: Number(thresholds?.silver ?? 0),
  gold: Number(thresholds?.gold ?? 0),
  platinum: Number(thresholds?.platinum ?? 0),
  diamond: Number(thresholds?.diamond ?? 0),
});

const thresholdsChanged = (previous: any, next: any) => {
  const prev = normalizeThresholds(previous);
  const current = normalizeThresholds(next);
  return prev.silver !== current.silver ||
    prev.gold !== current.gold ||
    prev.platinum !== current.platinum ||
    prev.diamond !== current.diamond;
};

export const getSettings = async (branchId: string) => {
  const settings = (await Settings.findOne({ branchId })) || (await Settings.create({ branchId }));
  return settings;
};

export const updateSettings = async (branchId: string, payload: Partial<Awaited<ReturnType<typeof getSettings>>>) => {
  const settings = (await Settings.findOne({ branchId })) || (await Settings.create({ branchId }));
  const previousThresholds = normalizeThresholds(settings.membershipThresholds);
  Object.assign(settings, payload);
  await settings.save();
  if (payload.membershipThresholds && thresholdsChanged(previousThresholds, settings.membershipThresholds)) {
    await recalculateMembershipsForThresholdChange(branchId);
  }
  return settings;
};
