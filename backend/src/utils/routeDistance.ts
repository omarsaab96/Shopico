import { env } from "../config/env";
import { haversineDistanceKm } from "./pricing";

type LatLng = {
  lat: number;
  lng: number;
};

const roundKm = (value: number) => Math.round(value * 100) / 100;

export const getRouteDistanceKm = async (origin: LatLng, destination: LatLng) => {
  if (!env.maps.googleMapsApiKey) {
    return haversineDistanceKm(origin.lat, origin.lng, destination.lat, destination.lng);
  }

  const params = new URLSearchParams({
    origin: `${origin.lat},${origin.lng}`,
    destination: `${destination.lat},${destination.lng}`,
    mode: "driving",
    key: env.maps.googleMapsApiKey,
  });

  try {
    const response = await fetch(`https://maps.googleapis.com/maps/api/directions/json?${params.toString()}`);
    const payload = await response.json() as any;
    const leg = payload?.routes?.[0]?.legs?.[0];
    const meters = Number(leg?.distance?.value);

    if (!response.ok || payload?.status !== "OK" || !Number.isFinite(meters)) {
      return haversineDistanceKm(origin.lat, origin.lng, destination.lat, destination.lng);
    }

    return roundKm(meters / 1000);
  } catch {
    return haversineDistanceKm(origin.lat, origin.lng, destination.lat, destination.lng);
  }
};
