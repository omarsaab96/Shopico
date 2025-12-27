import { Link } from "expo-router";
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from "react";
import { Text, View, StyleSheet, TouchableOpacity, FlatList, RefreshControl } from "react-native";
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetModalProvider, BottomSheetView } from "@gorhom/bottom-sheet";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Button from "../components/Button";
import Screen from "../components/Screen";
import { useCart } from "../lib/cart";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/theme";
import { useI18n } from "../lib/i18n";

export default function CartScreen() {
  const router = useRouter();
  const { items, removeItem, clear, setQuantity, reload } = useCart();
  const { user } = useAuth();
  const sheetRef = useRef<BottomSheetModal>(null);
  const clearSheetRef = useRef<BottomSheetModal>(null);
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);
  const [skipConfirm, setSkipConfirm] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
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
                  <TouchableOpacity style={styles.qtyButton} onPress={() => setQuantity(item.productId, item.quantity - 1)}>
                    <Text style={styles.qtySymbol}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.qtyValue}>{item.quantity}</Text>
                  <TouchableOpacity style={styles.qtyButton} onPress={() => setQuantity(item.productId, item.quantity + 1)}>
                    <Text style={styles.qtySymbol}>+</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={() => confirmRemove(item.productId)} style={{ marginLeft: 12 }}>
                  <Text style={styles.link}>{t("remove") ?? "Remove"}</Text>
                </TouchableOpacity>
              </View>
            )}
          />
        )}

        {items.length > 0 && <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{t("subtotal")}</Text>
          <Text style={styles.totalValue}>{subtotal.toLocaleString()} SYP</Text>
        </View>}

        {items.length > 0 && <View style={{ gap: 8 }}>
          <Button title={t("clearCart")} onPress={confirmClear} secondary />
          {user ? (
            <Link href="/checkout" asChild>
              <Button title={t("checkout")} onPress={() => { }} />
            </Link>
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
      >
        <BottomSheetView style={styles.sheetContainer}>
          <Text style={styles.sheetTitle}>{t("confirmRemove") ?? "Remove item?"}</Text>
          <Text style={styles.sheetText}>{t("confirmRemoveCopy") ?? "Are you sure you want to remove this item from your cart?"}</Text>
          <TouchableOpacity style={styles.checkRow} onPress={toggleSkip}>
            <View style={[styles.checkbox, skipConfirm && styles.checkboxChecked]}>
              {skipConfirm ? <Text style={styles.checkboxMark}>✓</Text> : null}
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
    </BottomSheetModalProvider>
  );
}

const createStyles = (palette: any, isRTL: boolean) =>
  StyleSheet.create({
    title: { color: palette.text, fontSize: 22, fontWeight: "800", marginBottom: 12, textAlign: isRTL ? "right" : "left" },
    row: {
      backgroundColor: palette.card,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: palette.border,
      flexDirection: "row",
      justifyContent: "space-between",
    },
    name: { color: palette.text, fontWeight: "700" },
    muted: { color: palette.muted },
    link: { color: palette.accent },
    totalRow: { flexDirection: "row", justifyContent: "space-between", marginVertical: 12 },
    totalLabel: { color: palette.muted },
    totalValue: { color: palette.text, fontWeight: "800" },
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
    emptyBox: {
      backgroundColor: palette.card,
      borderRadius: 14,
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
    sheetContainer: { padding: 16, gap: 12 },
    sheetTitle: { color: palette.text, fontSize: 18, fontWeight: "800" },
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
  });
