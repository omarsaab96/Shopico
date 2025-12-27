import { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList } from "react-native";
import MapView, { Marker, MapPressEvent } from "react-native-maps";
import * as Location from "expo-location";
import Screen from "../components/Screen";
import api from "../lib/api";
import { useTheme } from "../lib/theme";
import { useI18n } from "../lib/i18n";

type Address = { _id: string; label: string; address: string; lat: number; lng: number; phone?: string };

export default function AddressesScreen() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [editing, setEditing] = useState<Address | null>(null);
  const [label, setLabel] = useState("");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [locationError, setLocationError] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const { palette } = useTheme();
  const { t, isRTL } = useI18n();
  const styles = useMemo(() => createStyles(palette, isRTL), [palette, isRTL]);

  const load = () => {
    api.get("/addresses").then((res) => setAddresses(res.data.data || []));
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setEditing(null);
    setLabel("");
    setAddress("");
    setLat("");
    setLng("");
    setPhone("");
  };

  const save = async () => {
    const payload = { label: label.trim(), address: address.trim(), lat: Number(lat), lng: Number(lng), phone: phone.trim() || undefined };
    if (!payload.label || !payload.address || isNaN(payload.lat) || isNaN(payload.lng)) return;
    if (editing) {
      await api.put(`/addresses/${editing._id}`, payload);
    } else {
      await api.post("/addresses", payload);
    }
    resetForm();
    load();
  };

  const startEdit = (item: Address) => {
    setEditing(item);
    setLabel(item.label);
    setAddress(item.address);
    setLat(String(item.lat));
    setLng(String(item.lng));
    setPhone(item.phone || "");
  };

  const remove = async (id: string) => {
    await api.delete(`/addresses/${id}`);
    if (editing?._id === id) resetForm();
    load();
  };

  const onMapPress = (e: MapPressEvent) => {
    setLat(e.nativeEvent.coordinate.latitude.toString());
    setLng(e.nativeEvent.coordinate.longitude.toString());
  };

  const useCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationError(t("locationDenied") ?? "Permission denied");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      setLat(pos.coords.latitude.toString());
      setLng(pos.coords.longitude.toString());
      setLocationError(null);
    } catch {
      setLocationError(t("locationError") ?? "Could not get location");
    }
  };

  return (
    <Screen showBack backLabel={t("back") ?? "Back"}>
      <Text style={styles.title}>{t("savedAddresses") ?? "Saved addresses"}</Text>

      <View style={styles.card}>
        <Text style={styles.section}>{editing ? t("editAddress") ?? "Edit address" : t("addAddress") ?? "Add address"}</Text>
        <TextInput style={styles.input} value={label} onChangeText={setLabel} placeholder={t("label") ?? "Label"} placeholderTextColor={palette.muted} />
        <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder={t("address")} placeholderTextColor={palette.muted} />
        <View style={styles.row}>
          <TextInput style={[styles.input, styles.half]} value={lat} onChangeText={setLat} placeholder={t("latitude")} placeholderTextColor={palette.muted} keyboardType="decimal-pad" />
          <TextInput style={[styles.input, styles.half]} value={lng} onChangeText={setLng} placeholder={t("longitude")} placeholderTextColor={palette.muted} keyboardType="decimal-pad" />
        </View>
        <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder={t("phone") ?? "Phone"} placeholderTextColor={palette.muted} keyboardType="phone-pad" />        
        <View style={styles.mapWrap}>
          <MapView
            style={styles.map}
            region={{
              latitude: parseFloat(lat) || 33.5138,
              longitude: parseFloat(lng) || 36.2765,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
            onPress={onMapPress}
          >
            <Marker coordinate={{ latitude: parseFloat(lat) || 33.5138, longitude: parseFloat(lng) || 36.2765 }} />
          </MapView>
          <View style={styles.mapActions}>
            <Text style={styles.muted}>
              {t("latitude")}: {lat || "—"} | {t("longitude")}: {lng || "—"}
            </Text>
            {locationError ? <Text style={styles.error}>{locationError}</Text> : null}
            <TouchableOpacity style={[styles.button, styles.secondary]} onPress={useCurrentLocation}>
              <Text style={styles.secondaryText}>{t("useCurrentLocation") ?? "Use current location"}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.row}>
          <TouchableOpacity style={[styles.button, styles.primary]} onPress={save}>
            <Text style={styles.buttonText}>{t("save") ?? "Save"}</Text>
          </TouchableOpacity>
          {editing && (
            <TouchableOpacity style={[styles.button, styles.secondary]} onPress={resetForm}>
              <Text style={styles.secondaryText}>{t("cancel") ?? "Cancel"}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={addresses}
        keyExtractor={(a) => a._id}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.section}>{item.label}</Text>
            <Text style={styles.muted}>{item.address}</Text>
            <Text style={styles.muted}>
              {t("latitude")}: {item.lat} | {t("longitude")}: {item.lng}
            </Text>
            {item.phone ? <Text style={styles.muted}>{item.phone}</Text> : null}
            <View style={styles.row}>
              <TouchableOpacity style={[styles.button, styles.primary]} onPress={() => startEdit(item)}>
                <Text style={styles.buttonText}>{t("edit") ?? "Edit"}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, styles.secondary]} onPress={() => remove(item._id)}>
                <Text style={styles.secondaryText}>{t("delete") ?? "Delete"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.muted}>{t("noAddresses") ?? "No addresses saved yet."}</Text>}
      />
    </Screen>
  );
}

const createStyles = (palette: any, isRTL: boolean) =>
  StyleSheet.create({
    title: { color: palette.text, fontSize: 22, fontWeight: "800", marginBottom: 12, textAlign: isRTL ? "right" : "left" },
    card: {
      backgroundColor: palette.card,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: palette.border,
      gap: 8,
      marginBottom: 12,
    },
    section: { color: palette.text, fontWeight: "800" },
    input: {
      backgroundColor: palette.surface,
      color: palette.text,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: palette.border,
    },
    row: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
    half: { flex: 1 },
    muted: { color: palette.muted },
    button: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 10,
      alignItems: "center",
      borderWidth: 1,
    },
    primary: { backgroundColor: palette.accent, borderColor: palette.accent },
    secondary: { backgroundColor: palette.surface, borderColor: palette.border },
    buttonText: { color: "#fff", fontWeight: "700" },
    secondaryText: { color: palette.text, fontWeight: "700" },
    mapWrap: { borderRadius: 12, overflow: "hidden", gap: 6 },
    map: { width: "100%", height: 220 },
    mapActions: { gap: 6 },
    error: { color: "red" },
  });
