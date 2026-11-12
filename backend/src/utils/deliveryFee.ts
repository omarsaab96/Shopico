import { roundAmount } from "./productUnits";

export function calculateDeliveryFee(distanceKm: number, freeKm: number, ratePerKm: number) {
  const billableKm = Math.ceil(Math.max(0, distanceKm - freeKm));
  return roundAmount(billableKm * ratePerKm);
}
