import { useEffect, useMemo, useRef, useState } from "react";
import { View, StyleSheet, TextInput, TouchableOpacity, FlatList, ActivityIndicator, Keyboard } from "react-native";
import MapView, { Marker, MapPressEvent } from "react-native-maps";
import * as Location from "expo-location";
import Constants from "expo-constants";
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetModalProvider, BottomSheetView } from "@gorhom/bottom-sheet";
import Screen from "../components/Screen";
import Text from "../components/Text";
import api from "../lib/api";
import { useTheme } from "../lib/theme";
import { useI18n } from "../lib/i18n";
import Feather from "@expo/vector-icons/Feather";
import AntDesign from "@expo/vector-icons/AntDesign";
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

type Address = { _id: string; label: string; address: string; lat: number; lng: number; phone?: string };
type PlaceSuggestion = { place_id: string; description: string };

const appJson = require("../app.json");
const expoCfg: any = Constants.expoConfig || (Constants as any).manifest || {};
const GOOGLE_PLACES_KEY =
  expoCfg?.android?.config?.googleMaps?.apiKey ||
  expoCfg?.ios?.config?.googleMapsApiKey ||
  appJson?.expo?.android?.config?.googleMaps?.apiKey ||
  appJson?.expo?.ios?.config?.googleMapsApiKey ||
  "";

export default function AddressesScreen() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [editing, setEditing] = useState<Address | null>(null);
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [locationError, setLocationError] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [placesError, setPlacesError] = useState<string | null>(null);
  const [selectedSuggestion, setSelectedSuggestion] = useState(false);
  const skipNextSearch = useRef(false);
  const deleteSheetRef = useRef<BottomSheetModal>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const { palette, isDark } = useTheme();
  const { t, isRTL } = useI18n();
  const styles = useMemo(() => createStyles(palette, isRTL), [palette, isRTL]);
  const renderBackdrop = useMemo(() => (props: any) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />, []);

  const load = () => {
    api.get("/addresses").then((res) => setAddresses(res.data.data || []));
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setEditing(null);
    setAdding(false);
    setLabel("");
    setAddress("");
    setLat("");
    setLng("");
    setPhone("");
    setSuggestions([]);
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

  const confirmRemove = (id: string) => {
    setPendingDelete(id);
    deleteSheetRef.current?.present();
  };

  const handleDeleteConfirm = () => {
    if (pendingDelete) remove(pendingDelete);
    setPendingDelete(null);
    deleteSheetRef.current?.dismiss();
  };

  const handleDeleteCancel = () => {
    setPendingDelete(null);
    deleteSheetRef.current?.dismiss();
  };

  const onMapPress = (e: MapPressEvent) => {
    setLat(e.nativeEvent.coordinate.latitude.toString());
    setLng(e.nativeEvent.coordinate.longitude.toString());
    reverseGeocode(e.nativeEvent.coordinate.latitude, e.nativeEvent.coordinate.longitude);
    Keyboard.dismiss()
  };

  const reverseGeocode = async (latitude: number, longitude: number) => {
    if (!GOOGLE_PLACES_KEY) return;
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_PLACES_KEY}`
      );
      const json = await res.json();
      if (json?.results?.[0]?.formatted_address) {
        skipNextSearch.current = true;
        setAddress(json.results[0].formatted_address);
      }
    } catch {
      // ignore
    }
  };

  const useCurrentLocation = async () => {
    try {
      console.log('Checking permissions...')

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        console.log("Permission to access location was denied")
        setLocationError(t("locationDenied") ?? "Permission denied");
        return;
      }
      console.log("Permission to access location granted")
      console.log("Getting current location...")

      const pos = await Location.getCurrentPositionAsync({});
      console.log("Location= ", pos)

      setLat(pos.coords.latitude.toString());
      setLng(pos.coords.longitude.toString());
      setLocationError(null);
      reverseGeocode(pos.coords.latitude, pos.coords.longitude);
    } catch {
      setLocationError(t("locationError") ?? "Could not get location");
    }
  };

  useEffect(() => {
    if (skipNextSearch.current) {
      skipNextSearch.current = false;
      return;
    }
    setSelectedSuggestion(false);
    if (!address || address.trim().length < 3) {
      setSuggestions([]);
      setPlacesError(null);
      return;
    }
    if (!GOOGLE_PLACES_KEY) {
      setSuggestions([]);
      setPlacesError("Google Maps key missing in app.json");
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setSearching(true);
        const res = await fetch(
          `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(address)}&key=${GOOGLE_PLACES_KEY}&language=en`,
          { signal: controller.signal }
        );
        const json = await res.json();
        if (json?.status && json.status !== "OK") {
          console.warn("Places autocomplete status:", json.status, json?.error_message);
          setPlacesError(json?.error_message || json.status);
          setSuggestions([]);
        } else {
          setPlacesError(null);
          setSuggestions(json?.predictions?.slice(0, 5) || []);
        }
      } catch (err) {
        if ((err as any).name !== "AbortError") {
          console.warn("Places autocomplete failed", err);
          setPlacesError(t("locationError") ?? "Could not fetch suggestions");
          setSuggestions([]);
        }
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [address]);

  const selectSuggestion = async (item: PlaceSuggestion) => {
    skipNextSearch.current = true;
    setSelectedSuggestion(true);
    setAddress(item.description);
    setSuggestions([]);
    setSearching(false);
    Keyboard.dismiss();
    if (!GOOGLE_PLACES_KEY) return;
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${item.place_id}&key=${GOOGLE_PLACES_KEY}&language=en`
      );
      const json = await res.json();
      if (json?.status && json.status !== "OK") {
        setPlacesError(json?.error_message || json.status);
        return;
      }
      const loc = json?.result?.geometry?.location;
      if (loc?.lat && loc?.lng) {
        setLat(loc.lat.toString());
        setLng(loc.lng.toString());
        setPlacesError(null);
      }
    } catch {
      // ignore lookup errors
    }
  };

  return (
    <BottomSheetModalProvider>
    <Screen showBack backLabel={t("back") ?? "Back"}>
      <Text weight="bold" style={styles.title}>{t("savedAddresses") ?? "Saved addresses"}</Text>

      {(editing || adding) && <View style={styles.card}>
        <Text weight="bold" style={styles.section}>{editing ? t("editAddress") ?? "Edit address" : t("addAddress") ?? "Add address"}</Text>
        <TextInput
        style={styles.input} value={label} onChangeText={setLabel} placeholder={t("label") ?? "Label"} placeholderTextColor={palette.muted} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <View style={{ position: "relative", flex: 1 }}>
            <TextInput
              style={[styles.search, { paddingLeft: 40 }]}
              value={address}
              onChangeText={setAddress}
              placeholder={t("address")}
              placeholderTextColor={palette.muted}
            />
            <Feather name="search" size={24} color={isDark ? "white" : "black"} style={styles.searchIcon} />
            {searching ? <ActivityIndicator size="small" color={palette.accent} style={styles.searchSpinner} /> : null}

            {address && !searching ? (
              <TouchableOpacity style={styles.searchSpinner}
                onPress={() => { setAddress(""); setSuggestions([]); setSelectedSuggestion(false); }}>
                <AntDesign name="close" size={20} color={isDark ? "white" : "black"} />
              </TouchableOpacity>
            ) : null}
          </View>
          <View>
            <TouchableOpacity style={{}} onPress={useCurrentLocation}>
              <MaterialIcons name="my-location" size={24} color={palette.accent} />
            </TouchableOpacity>
          </View>
        </View>

        {placesError ? <Text style={styles.error}>{placesError}</Text> : null}
        {suggestions.length > 0 && (
          <View style={styles.suggestionBox}>
            {suggestions.map((s) => (
              <TouchableOpacity key={s.place_id} style={styles.suggestionRow} onPress={() => selectSuggestion(s)}>
                <Text style={styles.suggestionText}>{s.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        {/* {!searching && !placesError && address.trim().length >= 3 && suggestions.length === 0 && !selectedSuggestion ? (
          <Text style={styles.muted}>{t("noResults") ?? "No results found"}</Text>
        ) : null} */}
        {/* <View style={styles.row}>
          <TextInput style={[styles.input, styles.half]} value={lat} onChangeText={setLat} placeholder={t("latitude")} placeholderTextColor={palette.muted} keyboardType="decimal-pad" />
          <TextInput style={[styles.input, styles.half]} value={lng} onChangeText={setLng} placeholder={t("longitude")} placeholderTextColor={palette.muted} keyboardType="decimal-pad" />
        </View> */}
        {/* <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder={t("phone") ?? "Phone"} placeholderTextColor={palette.muted} keyboardType="phone-pad" /> */}
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
            {/* <Text style={styles.muted}>
              {t("latitude")}: {lat || "—"} | {t("longitude")}: {lng || "—"}
            </Text> */}
            {locationError ? <Text style={styles.error}>{locationError}</Text> : null}

          </View>
        </View>

        <View style={styles.row}>
          <TouchableOpacity style={[styles.button, styles.primary]} onPress={save}>
            <Text weight="bold" style={styles.buttonText}>{t("save") ?? "Save"}</Text>
          </TouchableOpacity>
          {(editing || adding) && (
            <TouchableOpacity style={[styles.button, styles.secondary]} onPress={resetForm}>
              <Text weight="bold" style={styles.secondaryText}>{t("cancel") ?? "Cancel"}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>}

      {!adding && <View>
        <TouchableOpacity style={styles.addAddressLink} onPress={() => { setAdding(true) }}>
          <Text weight="bold" style={styles.addAddressLinkText}>{t('addNewAddress')}</Text>
        </TouchableOpacity>
      </View>}

      {!adding && !editing && <FlatList
        data={addresses}
        keyExtractor={(a) => a._id}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text weight="bold" style={styles.section}>{item.label}</Text>
            <Text style={styles.muted}>{item.address}</Text>
            {item.phone ? <Text style={styles.muted}>{item.phone}</Text> : null}
            <View style={styles.row}>
              <TouchableOpacity style={[styles.button, styles.primary]} onPress={() => startEdit(item)}>
                <Text weight="bold" style={styles.buttonText}>{t("edit") ?? "Edit"}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, styles.secondary]} onPress={() => confirmRemove(item._id)}>
                <Text weight="bold" style={styles.secondaryText}>{t("delete") ?? "Delete"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.muted}>{t("noAddresses") ?? "No addresses saved yet."}</Text>}
      />}
    </Screen>

    <BottomSheetModal
      ref={deleteSheetRef}
      snapPoints={["30%"]}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      onDismiss={() => setPendingDelete(null)}
      backgroundStyle={{ backgroundColor: palette.card, borderRadius: 20 }}
      handleIndicatorStyle={{ backgroundColor: palette.muted }}
    >
      <BottomSheetView style={styles.sheetContainer}>
        <Text weight="bold" style={styles.sheetTitle}>{t("confirmRemove") ?? "Remove address?"}</Text>
        <Text style={styles.sheetText}>{t("confirmRemoveCopy") ?? "Are you sure you want to remove this item from your list?"}</Text>
        <View style={styles.sheetActions}>
          <TouchableOpacity style={[styles.sheetButton, styles.sheetButtonSecondary]} onPress={handleDeleteCancel}>
            <Text weight="bold" style={styles.sheetButtonTextSecondary}>{t("no") ?? "No"}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.sheetButton, styles.sheetButtonPrimary]} onPress={handleDeleteConfirm}>
            <Text weight="bold" style={styles.sheetButtonTextPrimary}>{t("yes") ?? "Yes"}</Text>
          </TouchableOpacity>
        </View>
      </BottomSheetView>
    </BottomSheetModal>
    </BottomSheetModalProvider>
  );
}

const createStyles = (palette: any, isRTL: boolean) =>
  StyleSheet.create({
    title: { color: palette.text, fontSize: 22, marginBottom: 12, textAlign:  "left"  },
    card: {
      backgroundColor: palette.card,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: palette.border,
      gap: 8,
      marginBottom: 12,
    },
    section: { color: palette.text, textAlign: 'left'},
    input: {
      backgroundColor: palette.surface,
      color: palette.text,
      borderRadius: 12,
      padding: 14,
      textAlign: isRTL ? "right" : "left",
    },
    search: {
      backgroundColor: palette.surface,
      borderRadius: 14,
      padding: 14,
      paddingLeft: isRTL ? 14 : 40,
      color: palette.text,
      paddingRight: isRTL ? 40 : 14,
      textAlign: isRTL ? "right" : "left",
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
    buttonText: { color: "#fff" },
    secondaryText: { color: palette.text },
    addAddressLink: {
      marginBottom: 20,
      backgroundColor: palette.card, borderColor: palette.border,
      borderRadius:12,
      padding:10
    },
    addAddressLinkText: {
      color: palette.accent,
      textAlign:'center'
    },
    mapWrap: { borderRadius: 12, overflow: "hidden", gap: 6 },
    map: { width: "100%", height: 220 },
    mapActions: { gap: 6 },
    error: { color: "red" },
    suggestionBox: {
      backgroundColor: palette.card,
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 12,
      marginTop: -6,
      marginBottom: 6,
      overflow: "hidden",
    },
    suggestionRow: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderBottomWidth: 1,
      borderBottomColor: palette.border,
    },
    suggestionText: { color: palette.text },
    searchIcon: {
      position: "absolute",
      left: 10,
      top: 12
    },
    searchSpinner: { position: "absolute", right: 12, top: 14 },
    clearText: { color: palette.text, fontSize: 16 },
    sheetContainer: { padding: 16, gap: 10 },
    sheetTitle: { color: palette.text, fontSize: 18 },
    sheetText: { color: palette.muted },
    sheetActions: { flexDirection: "row", gap: 10 },
    sheetButton: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center" },
    sheetButtonPrimary: { backgroundColor: palette.accent },
    sheetButtonSecondary: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
    sheetButtonTextPrimary: { color: "#0f172a" },
    sheetButtonTextSecondary: { color: palette.text },
  });
