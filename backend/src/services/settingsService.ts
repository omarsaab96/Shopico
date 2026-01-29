import { Settings } from "../models/Settings";

export const getSettings = async (branchId: string) => {
  const settings = (await Settings.findOne({ branchId })) || (await Settings.create({ branchId }));
  return settings;
};

export const updateSettings = async (branchId: string, payload: Partial<Awaited<ReturnType<typeof getSettings>>>) => {
  const settings = (await Settings.findOne({ branchId })) || (await Settings.create({ branchId }));
  Object.assign(settings, payload);
  await settings.save();
  return settings;
};
