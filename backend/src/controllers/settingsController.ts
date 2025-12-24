import { catchAsync } from "../utils/catchAsync";
import { getSettings, updateSettings } from "../services/settingsService";
import { sendSuccess } from "../utils/response";
import { updateSettingsSchema } from "../validators/settingsValidators";

export const getSettingsHandler = catchAsync(async (_req, res) => {
  const settings = await getSettings();
  sendSuccess(res, settings);
});

export const updateSettingsHandler = catchAsync(async (req, res) => {
  const payload = updateSettingsSchema.parse(req.body);
  const settings = await updateSettings(payload);
  sendSuccess(res, settings, "Settings updated");
});
