import type { IUser } from "../models/User";

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
      branchId?: string;
    }
  }
}

export {};
