import jwt, { Secret } from "jsonwebtoken";
import { env } from "../config/env";
import { IUser } from "../models/User";

export const signAccessToken = (user: IUser) => {
  return jwt.sign({ sub: user._id.toString(), role: user.role }, env.jwtSecret as Secret, {
    expiresIn: env.jwtExpiresIn as unknown as jwt.SignOptions["expiresIn"],
  });
};

export const signRefreshToken = (user: IUser) => {
  return jwt.sign({ sub: user._id.toString() }, env.jwtRefreshSecret as Secret, {
    expiresIn: env.jwtRefreshExpiresIn as unknown as jwt.SignOptions["expiresIn"],
  });
};

export const verifyRefreshToken = (token: string) => {
  try {
    return jwt.verify(token, env.jwtRefreshSecret as Secret) as { sub: string };
  } catch {
    throw { status: 401, message: "Session expired. Please log in again" };
  }
};
