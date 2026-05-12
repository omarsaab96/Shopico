import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/response";
import { currencySchema } from "../validators/currencyValidators";
import { createCurrency, deleteCurrency, listCurrencies, updateCurrency } from "../services/currencyService";

export const getCurrencies = catchAsync(async (req, res) => {
  if (!req.branchId) return res.status(400).json({ success: false, message: "Branch access required" });
  const { q } = req.query as { q?: string };
  const currencies = await listCurrencies(req.branchId, q);
  sendSuccess(res, currencies);
});

export const createCurrencyHandler = catchAsync(async (req, res) => {
  if (!req.branchId) return res.status(400).json({ success: false, message: "Branch access required" });
  const payload = currencySchema.parse(req.body);
  const currency = await createCurrency(req.branchId, payload);
  sendSuccess(res, currency, "Currency created", 201);
});

export const updateCurrencyHandler = catchAsync(async (req, res) => {
  if (!req.branchId) return res.status(400).json({ success: false, message: "Branch access required" });
  const payload = currencySchema.partial().parse(req.body);
  const currency = await updateCurrency(req.branchId, req.params.id, payload);
  if (!currency) return res.status(404).json({ success: false, message: "Currency not found" });
  sendSuccess(res, currency, "Currency updated");
});

export const deleteCurrencyHandler = catchAsync(async (req, res) => {
  if (!req.branchId) return res.status(400).json({ success: false, message: "Branch access required" });
  const { currency, error } = await deleteCurrency(req.branchId, req.params.id);
  if (error) return res.status(400).json({ success: false, message: error });
  if (!currency) return res.status(404).json({ success: false, message: "Currency not found" });
  sendSuccess(res, currency, "Currency deleted");
});
