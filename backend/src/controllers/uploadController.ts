import ImageKit from "imagekit";
import { env } from "../config/env";
import { sendSuccess } from "../utils/response";

const imagekit = new ImageKit({
  publicKey: env.imageKit.publicKey.trim(),
  privateKey: env.imageKit.privateKey.trim(),
  urlEndpoint: env.imageKit.urlEndpoint.trim(),
});

export const getImageKitAuth = (_req: any, res: any) => {
  if (!env.imageKit.publicKey || !env.imageKit.privateKey || !env.imageKit.urlEndpoint) {
    return res.status(500).json({ success: false, message: "ImageKit keys missing on server" });
  }
  const params = imagekit.getAuthenticationParameters();
  sendSuccess(res, { ...params, publicKey: env.imageKit.publicKey.trim() });
};
