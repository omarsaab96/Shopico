import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { ApiResponse } from "../types";

// Centralized error handler to keep consistent API responses
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const errorHandler = (err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) {
    return res.status(400).json({ success: false, message: "Validation failed", errors: err.issues });
  }
  if (err?.code === 11000) {
    const duplicateFields = Object.keys(err?.keyPattern || err?.keyValue || {});
    if (duplicateFields.includes("barcode")) {
      return res.status(409).json({
        success: false,
        message: "Barcode already exists in this branch",
      });
    }
    return res.status(409).json({ success: false, message: "Duplicate value" });
  }
  const status = err.status || 500;
  const message = err.message || "Internal server error";
  const response: ApiResponse<null> = { success: false, message };
  if (process.env.NODE_ENV !== "production") {
    response.errors = err.stack || err;
  }
  res.status(status).json(response);
};
