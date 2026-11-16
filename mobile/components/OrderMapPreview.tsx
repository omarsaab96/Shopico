import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { createElement } from "react";
import { StyleSheet, View } from "react-native";
import { orderPreviewCoordinates, orderPreviewRegion, type OrderPreview } from "../lib/orderPreview";
import { useI18n } from "../lib/i18n";
import { useTheme } from "../lib/theme";

export default function OrderMapPreview({ order }: { order: OrderPreview }) {
  const { palette } = useTheme();
  const { t } = useI18n();
  const { destination, driver } = orderPreviewCoordinates(order);
  const region = orderPreviewRegion([destination, driver].filter(point => point !== null));
  const marker = driver ?? destination;
  const src = region && marker ? `https://www.openstreetmap.org/export/embed.html?bbox=${region.longitude - region.longitudeDelta / 2},${region.latitude - region.latitudeDelta / 2},${region.longitude + region.longitudeDelta / 2},${region.latitude + region.latitudeDelta / 2}&layer=mapnik&marker=${marker.latitude},${marker.longitude}` : null;
  return <View pointerEvents="none" style={[styles.preview, { backgroundColor: palette.surface }]}>
    {src ? createElement("iframe", { src, title: t("orderMapPreview"), loading: "lazy", tabIndex: -1,
      style: { position: "absolute", width: "100%", height: "100%", border: 0, pointerEvents: "none" } })
      : <MaterialIcons name="map" size={30} color={palette.muted} />}
  </View>;
}
const styles = StyleSheet.create({ preview: { flex: 1, alignItems: "center", justifyContent: "center" } });
