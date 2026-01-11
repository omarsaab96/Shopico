import { Promotion } from "../models/Promotion";
import { promotionSchema } from "../validators/promotionValidators";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/response";

const hasValidWindow = (startsAt?: Date, endsAt?: Date) => {
  if (startsAt && endsAt && endsAt < startsAt) {
    return false;
  }
  return true;
};

export const listPromotions = catchAsync(async (req, res) => {
  const { q, from, to } = req.query as { q?: string; from?: string; to?: string };
  const filter: Record<string, any> = {};

  if (q) {
    filter.$or = [
      { title: { $regex: q, $options: "i" } },
      { description: { $regex: q, $options: "i" } },
      { link: { $regex: q, $options: "i" } },
    ];
  }

  if (from) {
    const fromDate = new Date(from);
    if (!Number.isNaN(fromDate.getTime())) {
      filter.startsAt = { ...(filter.startsAt || {}), $gte: fromDate };
    }
  }

  if (to) {
    const toDate = new Date(to);
    if (!Number.isNaN(toDate.getTime())) {
      filter.endsAt = { ...(filter.endsAt || {}), $lte: toDate };
    }
  }

  const promotions = await Promotion.find(filter).sort({ createdAt: -1 });
  sendSuccess(res, promotions);
});

export const listActivePromotions = catchAsync(async (_req, res) => {
  const now = new Date();
  const promotions = await Promotion.find({
    isEnabled: true,
    startsAt: { $lte: now },
    endsAt: { $gte: now },
  }).sort({ createdAt: -1 });
  sendSuccess(res, promotions);
});

export const createPromotion = catchAsync(async (req, res) => {
  const payload = promotionSchema.parse(req.body);
  if (!hasValidWindow(payload.startsAt, payload.endsAt)) {
    return res.status(400).json({ success: false, message: "End date must be after start date" });
  }
  const promotion = await Promotion.create(payload);
  sendSuccess(res, promotion, "Promotion created", 201);
});

export const updatePromotion = catchAsync(async (req, res) => {
  const payload = promotionSchema.partial().parse(req.body);
  if (!hasValidWindow(payload.startsAt, payload.endsAt)) {
    return res.status(400).json({ success: false, message: "End date must be after start date" });
  }
  const promotion = await Promotion.findByIdAndUpdate(req.params.id, payload, { new: true });
  if (!promotion) return res.status(404).json({ success: false, message: "Promotion not found" });
  sendSuccess(res, promotion, "Promotion updated");
});

export const deletePromotion = catchAsync(async (req, res) => {
  const deleted = await Promotion.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ success: false, message: "Promotion not found" });
  sendSuccess(res, deleted, "Promotion deleted");
});
