import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Platform, StyleSheet, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import { orderPreviewCoordinates, orderPreviewRegion, type OrderPreview } from "../lib/orderPreview";
import { useTheme } from "../lib/theme";

export default function OrderMapPreview({ order }: { order: OrderPreview }) {
  const { palette } = useTheme();
  const { destination, driver } = orderPreviewCoordinates(order);
  const region = orderPreviewRegion([destination, driver].filter(point => point !== null));
  return (
    <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" style={[styles.preview, { backgroundColor: palette.surface }]}>
      {region ? <MapView style={StyleSheet.absoluteFill} region={region} liteMode={Platform.OS === "android"}
        scrollEnabled={false} zoomEnabled={false} rotateEnabled={false} pitchEnabled={false}
        toolbarEnabled={false} showsCompass={false} showsScale={false} showsPointsOfInterest={false}>
        {destination && <Marker coordinate={destination} pinColor={palette.accent} />}
        {driver && <Marker coordinate={driver} pinColor="#4f46e5" />}
      </MapView> : <MaterialIcons name="map" size={30} color={palette.muted} />}
    </View>
  );
}
const styles = StyleSheet.create({ preview: { flex: 1, alignItems: "center", justifyContent: "center" } });
