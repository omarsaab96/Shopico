export type OrderCoordinate = { latitude: number; longitude: number };
export type OrderPreview = {
  _id: string; status: string; createdAt?: string; updatedAt?: string;
  lat?: number | string | null; lng?: number | string | null;
  driverLocation?: { lat?: number | string | null; lng?: number | string | null; updatedAt?: string } | null;
  addressRef?: string | { lat?: number | string | null; lng?: number | string | null } | null;
};

function coordinate(lat: unknown, lng: unknown): OrderCoordinate | null {
  if (lat == null || lng == null || String(lat).trim() === "" || String(lng).trim() === "") return null;
  const latitude = Number(lat), longitude = Number(lng);
  return Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
    ? { latitude, longitude } : null;
}

export function orderPreviewCoordinates(order: OrderPreview) {
  const address = typeof order.addressRef === "object" ? order.addressRef : null;
  return {
    destination: coordinate(order.lat, order.lng) ?? coordinate(address?.lat, address?.lng),
    driver: order.status === "SHIPPING" ? coordinate(order.driverLocation?.lat, order.driverLocation?.lng) : null,
  };
}

export function orderPreviewRegion(points: OrderCoordinate[]) {
  if (!points.length) return null;
  const latitudes = points.map(point => point.latitude), longitudes = points.map(point => point.longitude);
  const minLat = Math.min(...latitudes), maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes), maxLng = Math.max(...longitudes);
  return { latitude: (minLat + maxLat) / 2, longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(0.008, (maxLat - minLat) * 1.7), longitudeDelta: Math.max(0.008, (maxLng - minLng) * 1.7) };
}
