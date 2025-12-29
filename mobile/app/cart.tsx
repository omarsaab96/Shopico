import { Link } from "expo-router";
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from "react";
import { Text, View, StyleSheet, TouchableOpacity, Image, FlatList, RefreshControl, ActivityIndicator, ScrollView } from "react-native";
import { BottomSheetBackdrop, BottomSheetScrollView, BottomSheetFooter, BottomSheetModal, BottomSheetModalProvider, BottomSheetView } from "@gorhom/bottom-sheet";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Button from "../components/Button";
import Screen from "../components/Screen";
import { useCart } from "../lib/cart";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/theme";
import { useI18n } from "../lib/i18n";
import api from "../lib/api";
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export default function CartScreen() {
  const router = useRouter();
  const { items, removeItem, clear, setQuantity, reload } = useCart();
  const { user } = useAuth();
  const sheetRef = useRef<BottomSheetModal>(null);
  const clearSheetRef = useRef<BottomSheetModal>(null);
  const checkoutSheetRef = useRef<BottomSheetModal>(null);
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);
  const [skipConfirm, setSkipConfirm] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddresses, setShowAddresses] = useState(false);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<any | null>(null);
  const [settings, setSettings] = useState<any | null>(null);
  const paymentMethods = ["CASH_ON_DELIVERY", "SHAM_CASH", "BANK_TRANSFER", "WALLET"] as const;
  const [paymentMethod, setPaymentMethod] = useState<typeof paymentMethods[number]>("CASH_ON_DELIVERY");
  const [showPaymentOptions, setShowPaymentOptions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const { palette } = useTheme();
  const { t, isRTL } = useI18n();
  const styles = useMemo(() => createStyles(palette, isRTL), [palette, isRTL]);
  const renderBackdrop = useMemo(() => (props: any) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />, []);

  useEffect(() => {
    AsyncStorage.getItem("cart-remove-skip").then((val) => setSkipConfirm(val === "true"));
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  };

  const loadSettings = () => {
    api.get("/settings").then((res) => setSettings(res.data.data)).catch(() => setSettings(null));
  };

  const loadAddresses = () => {
    if (!user) {
      setAddresses([]);
      setSelectedAddress(null);
      return;
    }
    api.get("/addresses")
      .then((res) => {
        const list = res.data.data || [];
        const sorted = [...list].sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime());
        setAddresses(sorted);
        setSelectedAddress((prev) => {
          if (prev) {
            const match = sorted.find((a: any) => a._id === prev._id);
            if (match) return match;
          }
          return sorted[0] || null;
        });
      })
      .catch(() => {
        setAddresses([]);
        setSelectedAddress(null);
      });
  };

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    AsyncStorage.getItem("last-payment-method")
      .then((stored) => {
        if (stored && (paymentMethods as readonly string[]).includes(stored)) {
          setPaymentMethod(stored as typeof paymentMethods[number]);
        }
      })
      .catch(() => { });
  }, []);

  const selectPaymentMethod = (method: typeof paymentMethods[number]) => {
    setPaymentMethod(method);
    setShowPaymentOptions(false);
    AsyncStorage.setItem("last-payment-method", method).catch(() => { });
  };

  useEffect(() => {
    loadAddresses();
  }, [user]);

  const confirmRemove = (productId: string) => {
    if (skipConfirm) {
      removeItem(productId);
      return;
    }
    setPendingRemove(productId);
    sheetRef.current?.present();
  };

  const handleRemoveConfirmed = () => {
    if (pendingRemove) removeItem(pendingRemove);
    setPendingRemove(null);
    sheetRef.current?.dismiss();
  };

  const handleCancel = () => {
    setPendingRemove(null);
    sheetRef.current?.dismiss();
  };

  const toggleSkip = () => {
    const next = !skipConfirm;
    setSkipConfirm(next);
    AsyncStorage.setItem("cart-remove-skip", next ? "true" : "false").catch(() => { });
  };

  const confirmClear = () => {
    clearSheetRef.current?.present();
  };

  const handleClearConfirmed = () => {
    clear();
    clearSheetRef.current?.dismiss();
  };

  const openCheckout = () => {
    if (!user) {
      router.push("/auth/login");
      return;
    }
    if (!items.length) return;
    loadAddresses();
    checkoutSheetRef.current?.present();
  };

  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 100) / 100;
  };
  const distanceKm =
    settings && selectedAddress ? haversine(settings.storeLat, settings.storeLng, selectedAddress.lat, selectedAddress.lng) : 0;
  const deliveryFee =
    settings && selectedAddress && distanceKm > settings.deliveryFreeKm
      ? Math.ceil(distanceKm - settings.deliveryFreeKm) * settings.deliveryRatePerKm
      : 0;

  const placeOrder = async () => {
    if (!user || !selectedAddress) return;
    setSubmitting(true);
    try {
      await api.post("/orders", {
        addressId: selectedAddress._id,
        paymentMethod,
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      });
      clear();
      checkoutSheetRef.current?.dismiss();
      router.replace("/(tabs)/orders");
    } finally {
      setSubmitting(false);
    }
  };

  const customFooter = (props: any) => (
    <BottomSheetFooter {...props}>
      <View
        style={{
          paddingHorizontal: 16,
          paddingBottom: 12,
          paddingTop: 12,
          backgroundColor: palette.surface,
          borderTopWidth: 1,
          borderColor: palette.border,
          gap: 8,
        }}
      >
        <View style={{ gap: 4 }}>
          <Text style={styles.sheetText}>
            {t("subtotal")}: {subtotal.toLocaleString()} SYP
          </Text>
          <Text style={styles.sheetText}>
            {t("deliveryFee")}: {deliveryFee?.toLocaleString()} SYP
          </Text>
          <Text style={styles.sheetTitle}>
            {t("total")}: {(subtotal + deliveryFee).toLocaleString()} SYP
          </Text>
        </View>
        <Button title={t("placeOrder")} onPress={placeOrder} disabled={!selectedAddress || submitting} />
        {submitting ? <ActivityIndicator color={palette.accent} style={{ marginTop: 8 }} /> : null}
      </View>
    </BottomSheetFooter>
  );

  return (
    <BottomSheetModalProvider>
      <Screen>
        <Text style={styles.title}>{t("cart")}</Text>

        {items.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>{t("emptyCartTitle") ?? "Your cart is empty"}</Text>
            <Text style={styles.emptyText}>{t("emptyCartCopy") ?? "Add items to your cart to see them here."}</Text>

            <TouchableOpacity style={styles.browseBtn} onPress={() => { router.replace("/(tabs)/store") }}>
              <Text style={styles.browseBtnText}>{t("startBrowsing") ?? "Start browsing"}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(i) => i.productId}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.accent} />}
            renderItem={({ item }) => (
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.muted}>
                    {item.price.toLocaleString()} SYP
                  </Text>
                </View>
                <View style={styles.qtyRow}>
                  <View style={styles.qtyRow}>
                    <TouchableOpacity style={styles.qtyButton} onPress={() => setQuantity(item.productId, item.quantity - 1)}>
                      <Text style={styles.qtySymbol}>-</Text>
                    </TouchableOpacity>
                    <Text style={styles.qtyValue}>{item.quantity}</Text>
                    <TouchableOpacity style={styles.qtyButton} onPress={() => setQuantity(item.productId, item.quantity + 1)}>
                      <Text style={styles.qtySymbol}>+</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity onPress={() => confirmRemove(item.productId)} style={styles.removeFromCartBtn}>
                    <MaterialIcons name="delete" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        )}

        {items.length > 0 && <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{t("subtotal")}</Text>
          <Text style={styles.totalValue}>{subtotal.toLocaleString()} SYP</Text>
        </View>}

        {items.length > 0 && <View style={{ gap: 8, paddingBottom: 16 }}>
          <Button title={t("clearCart")} onPress={confirmClear} secondary />
          {user ? (
            <Button title={t("checkout")} onPress={openCheckout} />
          ) : (
            <Button title={t("loginToCheckout") ?? "Login to checkout"} onPress={() => router.push("/auth/login")} />
          )}
        </View>}
      </Screen>

      <BottomSheetModal
        ref={sheetRef}
        snapPoints={["35%"]}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        onDismiss={() => setPendingRemove(null)}
        backgroundStyle={{ backgroundColor: palette.card, borderRadius: 20 }}
        handleIndicatorStyle={{ backgroundColor: palette.muted }}
      >
        <BottomSheetView style={styles.sheetContainer}>
          <Text style={styles.sheetTitle}>{t("confirmRemove") ?? "Remove item?"}</Text>
          <Text style={styles.sheetText}>{t("confirmRemoveCopy") ?? "Are you sure you want to remove this item from your cart?"}</Text>
          <TouchableOpacity style={styles.checkRow} onPress={toggleSkip}>
            <View style={[styles.checkbox, skipConfirm && styles.checkboxChecked]}>
              {skipConfirm ? <Text style={styles.checkboxMark}>X</Text> : null}
            </View>
            <Text style={styles.checkLabel}>{t("dontAskAgain") ?? "Don't ask again"}</Text>
          </TouchableOpacity>
          <View style={styles.sheetActions}>
            <TouchableOpacity style={[styles.sheetButton, styles.sheetButtonSecondary]} onPress={handleCancel}>
              <Text style={styles.sheetButtonTextSecondary}>{t("no") ?? "No"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.sheetButton, styles.sheetButtonPrimary]} onPress={handleRemoveConfirmed}>
              <Text style={styles.sheetButtonTextPrimary}>{t("yes") ?? "Yes"}</Text>
            </TouchableOpacity>
          </View>
        </BottomSheetView>
      </BottomSheetModal>

      <BottomSheetModal
        ref={clearSheetRef}
        snapPoints={["30%"]}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: palette.card, borderRadius: 20 }}
        handleIndicatorStyle={{ backgroundColor: palette.muted }}
      >
        <BottomSheetView style={styles.sheetContainer}>
          <Text style={styles.sheetTitle}>{t("confirmClearCart") ?? "Clear cart?"}</Text>
          <Text style={styles.sheetText}>{t("confirmClearCartCopy") ?? "This will remove all items from your cart."}</Text>
          <View style={styles.sheetActions}>
            <TouchableOpacity style={[styles.sheetButton, styles.sheetButtonSecondary]} onPress={() => clearSheetRef.current?.dismiss()}>
              <Text style={styles.sheetButtonTextSecondary}>{t("no") ?? "No"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.sheetButton, styles.sheetButtonPrimary]} onPress={handleClearConfirmed}>
              <Text style={styles.sheetButtonTextPrimary}>{t("yes") ?? "Yes"}</Text>
            </TouchableOpacity>
          </View>
        </BottomSheetView>
      </BottomSheetModal>

      <BottomSheetModal
        ref={checkoutSheetRef}
        snapPoints={useMemo(() => ["80%"], [])}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        footerComponent={customFooter}
        onDismiss={() => setSubmitting(false)}
        backgroundStyle={{ backgroundColor: palette.card, borderRadius: 20 }}
        handleIndicatorStyle={{ backgroundColor: palette.muted }}
      >
        <BottomSheetScrollView
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 180 }}
        >
          <View>
            <Text style={[styles.sheetTitle, { paddingTop: 16, paddingHorizontal: 16 }]}>{t("checkout")}</Text>
            <View style={{ marginBottom: 20, paddingHorizontal: 16 }}>
              <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: palette.surface,
                padding: 10,
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20
              }}>

                <Text style={styles.section}>{t("address")}</Text>

                {!showAddresses ? (
                  <TouchableOpacity style={styles.addressBtn} onPress={() => { setShowAddresses(true) }}>
                    <Text style={styles.addressBtnText}>{selectedAddress ? t("change") ?? "Change address" : t("addAddress") ?? "Add address"}</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity style={styles.addressBtn} onPress={() => { setShowAddresses(false) }}>
                      <Text style={styles.addressBtnText}>{t("cancel") ?? "Cancel"}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.addressBtn} onPress={() => { router.push("/addresses") }}>
                      <Text style={styles.addressBtnText}>{t("manageAddresses") ?? "Manage addresses"}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {!showAddresses && selectedAddress &&
                <View style={styles.addressBox}>
                  <View style={{
                    backgroundColor: "#fff",
                    padding: 10,
                    borderRadius: 20
                  }}>
                    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                      <Text style={styles.addressLabel}>{selectedAddress.label}</Text>
                      <Text style={styles.distance}>{distanceKm} Km</Text>
                    </View>

                    <Text style={styles.addressText}>{selectedAddress.address}</Text>
                    {/* <Text style={styles.sheetText}>
                {t("distance")}: {distanceKm} km • {t("deliveryFee")}: {deliveryFee?.toLocaleString()} SYP
              </Text> */}
                  </View>
                </View>
              }

              {showAddresses && addresses.length > 0 && (
                <View style={styles.addressBox}>
                  <View style={{
                    backgroundColor: "#fff",
                    padding: 10,
                    borderRadius: 20,
                    gap: 5
                  }}>
                    {addresses.map((addr) => (
                      <TouchableOpacity
                        key={addr._id}
                        style={[styles.pillRow, selectedAddress?._id === addr._id && styles.pillRowActive]}
                        onPress={() => { setSelectedAddress(addr); setShowAddresses(false) }}
                      >
                        {selectedAddress?._id === addr._id && <FontAwesome name="check" size={20} color={palette.accent} style={[styles.selectedTick, isRTL ? { left: 5 } : { right: 5 }]} />}
                        <Text style={styles.addressLabel}>{addr.label}</Text>
                        <Text style={styles.addressText}>{addr.address}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

            </View>

            <View style={{ marginBottom: 20, paddingHorizontal: 16 }}>
              <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: palette.surface,
                padding: 10,
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20
              }}>
                <Text style={styles.section}>{t("paymentMethod") ?? "Payment"}</Text>
                {!showPaymentOptions ? (
                  <TouchableOpacity style={styles.addressBtn} onPress={() => setShowPaymentOptions(true)}>
                    <Text style={styles.addressBtnText}>{t("change") ?? "Change"}</Text>
                  </TouchableOpacity>
                ) :
                  <TouchableOpacity style={styles.addressBtn} onPress={() => setShowPaymentOptions(false)}>
                    <Text style={styles.addressBtnText}>{t("cancel") ?? "Cancel"}</Text>
                  </TouchableOpacity>
                }
              </View>

              {!showPaymentOptions ? (
                <View style={styles.addressBox}>
                  <Text style={[styles.sheetText, {
                    backgroundColor: "#fff",
                    padding: 10,
                    borderRadius: 20
                  }]}>{paymentMethod}</Text>
                </View>
              ) : (
                <View style={styles.addressBox}>
                  <View style={{
                    backgroundColor: "#fff",
                    padding: 10,
                    borderRadius: 20,
                    gap: 5
                  }}>
                    {paymentMethods.map((method) => (
                      <TouchableOpacity
                        key={method}
                        style={[styles.pillRow, paymentMethod === method && styles.pillRowActive]}
                        onPress={() => selectPaymentMethod(method)}
                      >
                        {paymentMethod === method && <FontAwesome name="check" size={20} color={palette.accent} style={[styles.selectedTick, {top:10}, isRTL ? { left: 5 } : { right: 5 }]} />}
                        <Text style={[styles.pillText, paymentMethod === method && styles.pillTextActive]}>{method}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </View>
          </View>

        </BottomSheetScrollView>


      </BottomSheetModal>
    </BottomSheetModalProvider>
  );
}

const createStyles = (palette: any, isRTL: boolean) =>
  StyleSheet.create({
    title: { color: palette.text, fontSize: 22, fontWeight: "800", marginBottom: 12, textAlign: isRTL ? "right" : "left" },
    row: {
      backgroundColor: palette.card,
      borderRadius: 20,
      padding: 12,
      borderWidth: 1,
      borderColor: palette.border,
      flexDirection: "row",
      justifyContent: "space-between",
    },
    name: { color: palette.text, fontWeight: "700" },
    muted: { color: palette.muted },
    link: { color: palette.accent },
    totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: 'center', marginVertical: 12 },
    totalLabel: { color: palette.muted },
    totalValue: { color: palette.text, fontWeight: "800", fontSize: 16 },
    qtyRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    qtyButton: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: palette.surface,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: palette.border,
    },
    qtySymbol: { color: palette.text, fontSize: 18, fontWeight: "800" },
    qtyValue: { color: palette.text, fontSize: 16, fontWeight: "800", minWidth: 24, textAlign: "center" },
    removeFromCartBtn: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: palette.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    removeFromCartIcon: {
      width: 20,
      height: 20,
      objectFit: 'contain',
      tintColor: '#fff'
    },
    emptyBox: {
      backgroundColor: palette.card,
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor: palette.border,
      alignItems: "center",
      gap: 8,
    },
    emptyTitle: { color: palette.text, fontSize: 18, fontWeight: "800" },
    emptyText: { color: palette.muted, textAlign: "center" },
    browseBtn: {
      backgroundColor: palette.accent,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 10,
      marginTop: 4,
    },
    browseBtnText: { color: "#fff", fontWeight: "700" },
    sheetContainer: { padding: 16 },
    sheetTitle: { color: palette.text, fontSize: 18, fontWeight: "800", marginBottom: 20 },
    section: {
      fontSize: 14,
      fontWeight: '500',
    },
    sheetText: { color: palette.muted },
    sheetActions: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
    sheetButton: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center", borderWidth: 1, borderColor: palette.border },
    sheetButtonSecondary: { backgroundColor: palette.surface },
    sheetButtonPrimary: { backgroundColor: palette.accent, borderColor: palette.accent },
    sheetButtonTextPrimary: { color: "#fff", fontWeight: "800" },
    sheetButtonTextSecondary: { color: palette.text, fontWeight: "700" },
    checkRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: palette.border,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: palette.card,
    },
    checkboxChecked: { borderColor: palette.accent, backgroundColor: palette.accentSoft },
    checkboxMark: { color: palette.text, fontWeight: "800" },
    checkLabel: { color: palette.text, fontWeight: "700" },
    addressBox: {
      gap: 4,
      borderBottomLeftRadius: 20,
      borderBottomRightRadius: 20,
      borderWidth: 4,
      borderColor: palette.surface,
      backgroundColor: palette.surface
    },
    addressLabel: { color: palette.text, fontWeight: "800" },
    distance: {
      fontSize: 14,
      color: palette.accent,
      fontWeight: "800"
    },
    addressText: { color: palette.text },
    addressBtn: {
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderRadius: 10,
      // borderWidth: 1,
      borderColor: palette.border,
      alignItems: "center",
      backgroundColor: palette.card,
    },
    addressBtnText: { color: palette.accent, fontWeight: "700" },
    pillRow: {
      padding: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: palette.border,
      // backgroundColor: palette.surface,
    },
    pillRowActive: { borderColor: palette.accent, position: 'relative' },
    selectedTick: { position: 'absolute', top: 5 },
    pillText: { color: palette.text, fontWeight: "700" },
    pillTextActive: { color: "#0f172a" },
  });
