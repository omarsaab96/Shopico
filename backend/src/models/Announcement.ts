import mongoose, { Document, Schema } from "mongoose";

export interface IAnnouncementImage {
  url: string;
  fileId: string;
}

export interface IAnnouncement extends Document {
  title?: string;
  description?: string;
  link?: string;
  image?: IAnnouncementImage;
  startsAt: Date;
  endsAt: Date;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AnnouncementImageSchema = new Schema<IAnnouncementImage>(
  {
    url: { type: String, required: true },
    fileId: { type: String, required: true },
  },
  { _id: false }
);

const defaultStartsAt = () => new Date();
const defaultEndsAt = () => {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date;
};

const AnnouncementSchema = new Schema<IAnnouncement>(
  {
    title: { type: String },
    description: { type: String },
    link: { type: String },
    image: { type: AnnouncementImageSchema },
    startsAt: { type: Date, default: defaultStartsAt },
    endsAt: { type: Date, default: defaultEndsAt },
    isEnabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Announcement = mongoose.model<IAnnouncement>("Announcement", AnnouncementSchema, "announcements");
