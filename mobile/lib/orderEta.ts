import { orderPreviewCoordinates, type OrderPreview } from "./orderPreview";

export async function requestOrderEta(order: OrderPreview, apiKey: string, signal?: AbortSignal): Promise<number | null> {
  const { driver, destination } = orderPreviewCoordinates(order);
  if (order.status !== "SHIPPING" || !driver || !destination || !apiKey) return null;
  const params = new URLSearchParams({
    origin: `${driver.latitude},${driver.longitude}`,
    destination: `${destination.latitude},${destination.longitude}`,
    mode: "driving", key: apiKey,
  });
  try {
    const response = await fetch(`https://maps.googleapis.com/maps/api/directions/json?${params}`, { signal });
    if (!response.ok) return null;
    const data = await response.json();
    const legs = data?.routes?.[0]?.legs;
    if (data?.status !== "OK" || !Array.isArray(legs) || !legs.length) return null;
    const durations = legs.map((leg: any) => leg?.duration?.value);
    if (durations.some(value => typeof value !== "number" || !Number.isFinite(value) || value < 0)) return null;
    return durations.reduce((sum, value) => sum + value, 0) / 60;
  } catch { return null; }
}
