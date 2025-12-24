import { env } from "../config/env";

const toRadians = (deg: number) => (deg * Math.PI) / 180;

export const haversineDistanceKm = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Earth radius in km
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(2));
};

export const calculateDeliveryFee = (distanceKm: number): number => {
  if (distanceKm <= env.store.freeKm) {
    return 0;
  }
  const extraKm = Math.ceil(distanceKm - env.store.freeKm);
  return extraKm * env.store.ratePerKm;
};

export const calculatePointsEarned = (subtotal: number, pointsPerAmount: number): number => {
  if (subtotal <= 0) return 0;
  return Math.floor(subtotal / pointsPerAmount);
};
