import { Response } from "express";
import { ApiResponse } from "../types";

export const sendSuccess = <T>(res: Response, data: T, message?: string, status = 200) => {
  const payload: ApiResponse<T> = { success: true, data, message };
  res.status(status).json(payload);
};

export const sendError = (res: Response, message: string, status = 400, errors?: unknown) => {
  const payload: ApiResponse<null> = { success: false, message, errors };
  res.status(status).json(payload);
};
