import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 4000,
  mongoUri: process.env.MONGO_URI || "mongodb://localhost:27017/shopico",
  jwtSecret: process.env.JWT_SECRET || "dev-secret",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || "dev-refresh-secret",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1h",
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  corsOrigins: (process.env.CORS_ORIGINS || "*").split(","),
  imageKit: {
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY || "",
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY || "",
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT || "",
  },
  store: {
    lat: parseFloat(process.env.STORE_LAT || "0"),
    lng: parseFloat(process.env.STORE_LNG || "0"),
    graceDays: parseInt(process.env.MEMBERSHIP_GRACE_DAYS || "14", 10),
    freeKm: parseFloat(process.env.DELIVERY_FREE_KM || "1"),
    ratePerKm: parseInt(process.env.DELIVERY_RATE_PER_KM || "5000", 10),
  },
};
