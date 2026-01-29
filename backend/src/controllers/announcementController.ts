import { Announcement } from "../models/Announcement";
import { announcementSchema } from "../validators/announcementValidators";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/response";
import { getDefaultBranchId } from "../utils/branch";

const hasValidWindow = (startsAt?: Date, endsAt?: Date) => {
  if (startsAt && endsAt && endsAt < startsAt) {
    return false;
  }
  return true;
};

export const listAnnouncements = catchAsync(async (req, res) => {
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

      if (toDate) {
        filter.$and.push({ startsAt: { $lte: toDate } });
      }

      if (fromDate) {
        filter.$and.push({ endsAt: { $gte: fromDate } });
      }
    }
  }

  const announcements = await Announcement.find(filter).sort({ createdAt: -1 });
  sendSuccess(res, announcements);
});

export const listActiveAnnouncements = catchAsync(async (_req, res) => {
  const req = _req as any;
  const branchId = req.branchId || (await getDefaultBranchId());
  if (!branchId) return res.status(400).json({ success: false, message: "Branch not configured" });
  const now = new Date();
  const announcements = await Announcement.find({
    branchId,
    isEnabled: true,
    startsAt: { $lte: now },
    endsAt: { $gte: now },
  }).sort({ createdAt: -1 });
  sendSuccess(res, announcements);
});

export const createAnnouncement = catchAsync(async (req, res) => {
  const payload = announcementSchema.parse(req.body);
  if (!hasValidWindow(payload.startsAt, payload.endsAt)) {
    return res.status(400).json({ success: false, message: "End date must be after start date" });
  }
  if (!req.branchId) return res.status(400).json({ success: false, message: "Branch access required" });
  const announcement = await Announcement.create({ ...payload, branchId: req.branchId });
  sendSuccess(res, announcement, "Announcement created", 201);
});

export const updateAnnouncement = catchAsync(async (req, res) => {
  const payload = announcementSchema.partial().parse(req.body);
  if (!hasValidWindow(payload.startsAt, payload.endsAt)) {
    return res.status(400).json({ success: false, message: "End date must be after start date" });
  }
  if (!req.branchId) return res.status(400).json({ success: false, message: "Branch access required" });
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
  const announcement = await Announcement.findOneAndUpdate(
    { _id: req.params.id, branchId: req.branchId },
    Object.keys(unset).length ? { $set: update, $unset: unset } : update,
    { new: true }
  );
  if (!announcement) return res.status(404).json({ success: false, message: "Announcement not found" });
  sendSuccess(res, announcement, "Announcement updated");
});

export const deleteAnnouncement = catchAsync(async (req, res) => {
  if (!req.branchId) return res.status(400).json({ success: false, message: "Branch access required" });
  const deleted = await Announcement.findOneAndDelete({ _id: req.params.id, branchId: req.branchId });
  if (!deleted) return res.status(404).json({ success: false, message: "Announcement not found" });
  sendSuccess(res, deleted, "Announcement deleted");
});
