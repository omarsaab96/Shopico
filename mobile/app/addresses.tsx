import { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList } from "react-native";
import Screen from "../components/Screen";
import api from "../lib/api";
import { useTheme } from "../lib/theme";
import { useI18n } from "../lib/i18n";
import * as Location from 'expo-location';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

type Address = { _id: string; label: string; address: string; lat: number; lng: number; phone?: string };

export default function AddressesScreen() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [editing, setEditing] = useState<Address | null>(null);
  const [label, setLabel] = useState("");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
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

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, marginBottom: 5 }}>
          <Text style={[styles.subtitle, styles.contactSubTitle, { width: 'auto' }]}>
            Location
          </Text>
          <TouchableOpacity
            style={styles.locationBtn}
            onPress={async () => {
              console.log('Checking permissions...')
              let { status } = await Location.requestForegroundPermissionsAsync();

              if (status !== 'granted') {
                console.log("Permission to access location was denied")
                alert('Permission to access location was denied. Go to your phone\'s settings and enable Riyadah to use your location');
                return;
              }
              console.log("Permission to access location granted")

              console.log("Getting current location...")
              let currentLocation = await Location.getCurrentPositionAsync({});
              console.log("Location= ", currentLocation)
              setLat(currentLocation.coords.latitude + "")
              setLng(currentLocation.coords.longitude + "")
            }}
          >
            <Text style={styles.locationBtnText}>Use My Current Location</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.hint}>Pinch to zoom, tap to pin location</Text>

        <View style={styles.map}>
          <MapView
            provider={PROVIDER_GOOGLE}
            style={styles.mapPreview}
            region={{
              latitude: lat || 0,
              longitude: lng || 0,
              latitudeDelta: lat ? 0.01 : 50,
              longitudeDelta: lng ? 0.01 : 50
            }}
            onPress={(e) => {
              const coords = e.nativeEvent.coordinate;
              setLat(String(coords.latitude))
              setLng(String(coords.longitude))
            }}
          >
            {location && (
              <Marker
                coordinate={{
                  latitude: parseFloat(lat),
                  longitude: parseFloat(lng),
                }
                }
                draggable
                onDragEnd={(e) => {
                  const coords = e.nativeEvent.coordinate;
                  setLat(String(coords.latitude))
                  setLng(String(coords.longitude))
                }}
              />
            )}
          </MapView>
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
  });
