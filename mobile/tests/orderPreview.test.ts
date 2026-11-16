import { describe, expect, it } from "vitest";
import { orderPreviewCoordinates, orderPreviewRegion, type OrderPreview } from "../lib/orderPreview";

const order: OrderPreview = { _id: "order", status: "SHIPPING", lat: "33.5", lng: "36.3", driverLocation: { lat: 33.51, lng: 36.32 } };
describe("order map previews", () => {
  it("uses delivery and driver coordinates during shipping", () => {
    expect(orderPreviewCoordinates(order)).toEqual({ destination: { latitude: 33.5, longitude: 36.3 }, driver: { latitude: 33.51, longitude: 36.32 } });
  });
  it("ignores old driver coordinates before delivery starts", () => {
    expect(orderPreviewCoordinates({ ...order, status: "PROCESSING" }).driver).toBeNull();
  });
  it("falls back to the saved address when order coordinates are absent", () => {
    expect(orderPreviewCoordinates({ _id: "order", status: "PENDING", addressRef: { lat: 33, lng: 36 } }).destination).toEqual({ latitude: 33, longitude: 36 });
  });
  it("rejects missing, blank, and out-of-range coordinates without inventing a map location", () => {
    for (const lat of [null, undefined, "", " ", "invalid", 91]) {
      expect(orderPreviewCoordinates({ _id: "order", status: "PENDING", lat, lng: 36 }).destination).toBeNull();
    }
    expect(orderPreviewRegion([])).toBeNull();
  });
  it("accepts valid zero coordinates and keeps a single-point preview zoomed in", () => {
    const point = orderPreviewCoordinates({ _id: "order", status: "PENDING", lat: 0, lng: 0 }).destination!;
    expect(orderPreviewRegion([point])).toEqual({ latitude: 0, longitude: 0, latitudeDelta: 0.008, longitudeDelta: 0.008 });
  });
  it("fits both driver and destination into the preview", () => {
    const points = [{ latitude: 33.5, longitude: 36.3 }, { latitude: 33.51, longitude: 36.32 }];
    const region = orderPreviewRegion(points)!;
    for (const point of points) {
      expect(Math.abs(point.latitude - region.latitude)).toBeLessThan(region.latitudeDelta / 2);
      expect(Math.abs(point.longitude - region.longitude)).toBeLessThan(region.longitudeDelta / 2);
    }
  });
});
