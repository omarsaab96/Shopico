import { Settings } from "../models/Settings";

export const getSettings = async () => {
  const settings = (await Settings.findOne()) || (await Settings.create({}));
  return settings;
};

export const updateSettings = async (payload: Partial<Awaited<ReturnType<typeof getSettings>>>) => {
  const settings = (await Settings.findOne()) || (await Settings.create({}));
  Object.assign(settings, payload);
  await settings.save();
  return settings;
};
