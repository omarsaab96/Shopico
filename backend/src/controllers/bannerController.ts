import { Banner } from "../models/Banner";
import { bannerSchema } from "../validators/bannerValidators";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/response";
import { getDefaultBranchId } from "../utils/branch";

const hasValidWindow = (startsAt?: Date, endsAt?: Date) => {
  if (startsAt && endsAt && endsAt < startsAt) {
    return false;
  }
  return true;
};

export const listBanners = catchAsync(async (req, res) => {
  const { q, from, to } = req.query as { q?: string; from?: string; to?: string };
  if (!req.branchId) return res.status(400).json({ success: false, message: "Branch access required" });
  const filter: Record<string, any> = { branchId: req.branchId };

  if (q) {
    filter.$or = [
      { title: { $regex: q, $options: "i" } },
      { description: { $regex: q, $options: "i" } },
      { link: { $regex: q, $options: "i" } },
    ];
  }

  if (from || to) {
    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to) : null;

    if (
      (fromDate && !Number.isNaN(fromDate.getTime())) ||
      (toDate && !Number.isNaN(toDate.getTime()))
    ) {
      filter.$and = [];

      if (toDate && !Number.isNaN(toDate.getTime())) {
        filter.$and.push({ startsAt: { $lte: toDate } });
      }

      if (fromDate && !Number.isNaN(fromDate.getTime())) {
        filter.$and.push({ endsAt: { $gte: fromDate } });
      }
    }
  }

  const banners = await Banner.find(filter).sort({ createdAt: -1 });
  sendSuccess(res, banners);
});

export const listActiveBanners = catchAsync(async (_req, res) => {
  const req = _req as any;
  const branchId = req.branchId || (await getDefaultBranchId());
  if (!branchId) return res.status(400).json({ success: false, message: "Branch not configured" });
  const now = new Date();
  const banners = await Banner.find({
    branchId,
    isEnabled: true,
    startsAt: { $lte: now },
    endsAt: { $gte: now },
  }).sort({ createdAt: -1 });
  sendSuccess(res, banners);
});

export const createBanner = catchAsync(async (req, res) => {
  const payload = bannerSchema.parse(req.body);
  if (!hasValidWindow(payload.startsAt, payload.endsAt)) {
    return res.status(400).json({ success: false, message: "End date must be after start date" });
  }
  if (!req.branchId) return res.status(400).json({ success: false, message: "Branch access required" });
  const banner = new Banner({ ...payload, branchId: req.branchId });
  if (!hasValidWindow(banner.startsAt, banner.endsAt)) {
    return res.status(400).json({ success: false, message: "End date must be after start date" });
  }
  await banner.save();
  sendSuccess(res, banner, "Banner created", 201);
});

export const updateBanner = catchAsync(async (req, res) => {
  const payload = bannerSchema.partial().parse(req.body);
  if (!hasValidWindow(payload.startsAt, payload.endsAt)) {
    return res.status(400).json({ success: false, message: "End date must be after start date" });
  }
  if (!req.branchId) return res.status(400).json({ success: false, message: "Branch access required" });
  const existing = await Banner.findOne({ _id: req.params.id, branchId: req.branchId });
  if (!existing) return res.status(404).json({ success: false, message: "Banner not found" });
  if (!hasValidWindow(payload.startsAt ?? existing.startsAt, payload.endsAt ?? existing.endsAt)) {
    return res.status(400).json({ success: false, message: "End date must be after start date" });
  }
  const update: Record<string, any> = { ...payload };
  const unset: Record<string, 1> = {};
  if (Object.prototype.hasOwnProperty.call(req.body, "link") && !req.body.link) {
    unset.link = 1;
    delete update.link;
  }
  if (Object.prototype.hasOwnProperty.call(req.body, "title") && !req.body.title) {
    unset.title = 1;
    delete update.title;
  }
  if (Object.prototype.hasOwnProperty.call(req.body, "description") && !req.body.description) {
    unset.description = 1;
    delete update.description;
  }
  const banner = await Banner.findOneAndUpdate(
    { _id: req.params.id, branchId: req.branchId },
    Object.keys(unset).length ? { $set: update, $unset: unset } : update,
    { new: true, runValidators: true }
  );
  if (!banner) return res.status(404).json({ success: false, message: "Banner not found" });
  sendSuccess(res, banner, "Banner updated");
});

export const deleteBanner = catchAsync(async (req, res) => {
  if (!req.branchId) return res.status(400).json({ success: false, message: "Branch access required" });
  const deleted = await Banner.findOneAndDelete({ _id: req.params.id, branchId: req.branchId });
  if (!deleted) return res.status(404).json({ success: false, message: "Banner not found" });
  sendSuccess(res, deleted, "Banner deleted");
});
