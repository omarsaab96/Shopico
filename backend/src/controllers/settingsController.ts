import { catchAsync } from "../utils/catchAsync";
import { getSettings, updateSettings } from "../services/settingsService";
import { sendSuccess } from "../utils/response";
import { updateSettingsSchema } from "../validators/settingsValidators";

export const getSettingsHandler = catchAsync(async (req, res) => {
  if (!req.branchId) return res.status(400).json({ success: false, message: "Branch access required" });
  const settings = await getSettings(req.branchId);
  sendSuccess(res, settings);
});

export const updateSettingsHandler = catchAsync(async (req, res) => {
  const payload = updateSettingsSchema.parse(req.body);
  if (!req.branchId) return res.status(400).json({ success: false, message: "Branch access required" });
  const settings = await updateSettings(req.branchId, payload);
  sendSuccess(res, settings, "Settings updated");
});
