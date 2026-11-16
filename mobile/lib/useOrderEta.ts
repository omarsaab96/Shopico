import { useEffect, useState } from "react";
import { useIsFocused } from "@react-navigation/native";
import Constants from "expo-constants";
import { requestOrderEta } from "./orderEta";
import { orderPreviewCoordinates, type OrderPreview } from "./orderPreview";

const appJson = require("../app.json");
const config: any = Constants.expoConfig || (Constants as any).manifest || {};
const apiKey = config?.android?.config?.googleMaps?.apiKey || config?.ios?.config?.googleMapsApiKey
  || appJson?.expo?.android?.config?.googleMaps?.apiKey || appJson?.expo?.ios?.config?.googleMapsApiKey || "";

export function useOrderEta(order: OrderPreview): number | null {
  const focused = useIsFocused();
  const { driver, destination } = orderPreviewCoordinates(order);
  const key = JSON.stringify([order._id, order.status, driver, destination]);
  const [state, setState] = useState<{ key: string; minutes: number | null }>({ key: "", minutes: null });
  useEffect(() => {
    if (!focused || order.status !== "SHIPPING" || !driver || !destination) return;
    let active = true;
    const controller = new AbortController();
    const snapshot: OrderPreview = {
      _id: order._id, status: "SHIPPING", lat: destination.latitude, lng: destination.longitude,
      driverLocation: { lat: driver.latitude, lng: driver.longitude },
    };
    void requestOrderEta(snapshot, apiKey, controller.signal).then(minutes => {
      if (active) setState({ key, minutes });
    });
    return () => { active = false; controller.abort(); };
  }, [key, focused]);
  return focused && order.status === "SHIPPING" && state.key === key ? state.minutes : null;
}
