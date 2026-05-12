import mongoose, { Document, Schema } from "mongoose";

export interface IAuditLog extends Document {
  user?: mongoose.Types.ObjectId;
  type?: string;
  action: string;
  result?: "SUCCESS" | "FAILURE";
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User" },
    type: { type: String },
    action: { type: String, required: true },
    result: { type: String, enum: ["SUCCESS", "FAILURE"] },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const AuditLog = mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);
