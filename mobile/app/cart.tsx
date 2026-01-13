import { Link } from "expo-router";
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, StyleSheet, TouchableOpacity, Image, FlatList, RefreshControl, ActivityIndicator, ScrollView, Animated, useWindowDimensions } from "react-native";
import { BottomSheetBackdrop, BottomSheetScrollView, BottomSheetFooter, BottomSheetModal, BottomSheetModalProvider, BottomSheetView } from "@gorhom/bottom-sheet";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Button from "../components/Button";
import Screen from "../components/Screen";
import Text from "../components/Text";
import { useCart } from "../lib/cart";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/theme";
import { useI18n } from "../lib/i18n";
import api from "../lib/api";
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import LottieView from "lottie-react-native";

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
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const paymentMethods = ["WALLET", "CASH_ON_DELIVERY", "SHAM_CASH"] as const;
  const { height: windowHeight } = useWindowDimensions();
  const [paymentMethod, setPaymentMethod] = useState<typeof paymentMethods[number]>("WALLET");
  const [showPaymentOptions, setShowPaymentOptions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [showSuccessContent, setShowSuccessContent] = useState(false);
  const [hideFooter, setHideFooter] = useState(false);
  const [successOrderId, setSuccessOrderId] = useState<string | null>(null);
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const { palette, isDark } = useTheme();
  const { t, isRTL } = useI18n();
  const styles = useMemo(() => createStyles(palette, isRTL, isDark), [palette, isRTL]);
  const renderBackdrop = useMemo(() => (props: any) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />, []);
  const addressRefreshOnVisit = useRef(false);
  const contentAnim = useRef(new Animated.Value(1)).current;
  const footerAnim = useRef(new Animated.Value(1)).current;
  const addressAnim = useRef(new Animated.Value(1)).current;
  const paymentAnim = useRef(new Animated.Value(1)).current;
  const successAnim = useRef(new Animated.Value(0)).current;
  const successContentAnim = useRef(new Animated.Value(0)).current;
  const footerPaddingAnim = useRef(new Animated.Value(0)).current;
  const [contentHeight, setContentHeight] = useState(0);
  const [successHeight, setSuccessHeight] = useState(0);
  const [footerHeight, setFooterHeight] = useState(0);
  const lottieRef = useRef(null);


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

  const loadWallet = () => {
    if (!user) {
      setWalletBalance(0);
      return;
    }
    api
      .get("/wallet")
      .then((res) => setWalletBalance(res.data.data.wallet?.balance || 0))
      .catch(() => setWalletBalance(0));
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
        } else {
          setPaymentMethod("WALLET");
          AsyncStorage.setItem("last-payment-method", "WALLET").catch(() => { });
        }
      })
      .catch(() => {
        setPaymentMethod("WALLET");
      });
  }, []);

  const selectPaymentMethod = (method: typeof paymentMethods[number]) => {
    setPaymentMethod(method);
    setShowPaymentOptions(false);
    AsyncStorage.setItem("last-payment-method", method).catch(() => { });
  };

  useEffect(() => {
    loadAddresses();
    loadWallet();
  }, [user]);

  useEffect(() => {
    if (showSuccessContent) {
      requestAnimationFrame(() => {
        lottieRef.current?.play(0, 145);
      });
    }
  }, [showSuccessContent]);

  useEffect(() => {
    if (checkoutSuccess) {
      setShowSuccessContent(false);
      setHideFooter(false);

      successContentAnim.setValue(0);
      footerPaddingAnim.setValue(footerHeight + 24);
      Animated.sequence([
        Animated.parallel([
          Animated.timing(contentAnim, {
            toValue: 0,
            duration: 420,
            useNativeDriver: true,
          }),
          Animated.timing(addressAnim, {
            toValue: 0,
            duration: 420,
            useNativeDriver: true,
          }),
          Animated.timing(paymentAnim, {
            toValue: 0,
            duration: 420,
            useNativeDriver: true,
          }),
          Animated.timing(footerAnim, {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
          }),
          Animated.timing(footerPaddingAnim, {
            toValue: 0,
            duration: 420,
            useNativeDriver: false,
          }),
          Animated.timing(successContentAnim, {
            toValue: 1,
            duration: 420,
            useNativeDriver: true,
          }),
        ]),
      ]).start(() => {
        setHideFooter(true);
        setShowSuccessContent(true);
        Animated.parallel([

          Animated.sequence([
            Animated.timing(successAnim, {
              toValue: 1.08,
              duration: 220,
              useNativeDriver: true,
            }),
            Animated.spring(successAnim, {
              toValue: 1,
              useNativeDriver: true,
              friction: 7,
              tension: 90,
            }),
          ]),
        ]).start();
        checkoutSheetRef.current?.snapToIndex(0);
      });
    } else {
      setShowSuccessContent(false);
      setHideFooter(false);
      contentAnim.setValue(1);
      footerAnim.setValue(1);
      addressAnim.setValue(1);
      paymentAnim.setValue(1);
      successAnim.setValue(0);
      successContentAnim.setValue(0);
      footerPaddingAnim.setValue(footerHeight + 24);
    }
  }, [checkoutSuccess, contentAnim, footerAnim, addressAnim, paymentAnim, successAnim, successContentAnim]);

  useFocusEffect(
    useCallback(() => {
      addressRefreshOnVisit.current = false;
      return () => {
        addressRefreshOnVisit.current = false;
      };
    }, [])
  );

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
    setPaymentMethod("WALLET");
    setCheckoutSuccess(false);
    setShowSuccessContent(false);
    setHideFooter(false);
    setSuccessOrderId(null);
    setCheckoutError(null);
    setShowAddresses(false);
    setShowPaymentOptions(false);
    contentAnim.setValue(1);
    footerAnim.setValue(1);
    addressAnim.setValue(1);
    paymentAnim.setValue(1);
    successAnim.setValue(0);
    successContentAnim.setValue(0);
    footerPaddingAnim.setValue(footerHeight + 24);
    AsyncStorage.setItem("last-payment-method", "WALLET").catch(() => { });
    if (!addressRefreshOnVisit.current) {
      loadAddresses();
      loadWallet();
      addressRefreshOnVisit.current = true;
    }
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
  const orderTotal = subtotal + deliveryFee;
  const walletInsufficient = paymentMethod === "WALLET" && walletBalance < orderTotal;

  const placeOrder = async () => {
    if (!user || !selectedAddress) return;
    setSubmitting(true);
    setCheckoutError(null);
    try {
      const res = await api.post("/orders", {
        addressId: selectedAddress._id,
        paymentMethod,
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      });
      const created = res?.data?.data;
      setSuccessOrderId(created?._id || created?.id || null);
      setCheckoutSuccess(true);
      clear();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Could not place order";
      setCheckoutError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const debugResetAnimations = () => {
    setCheckoutSuccess(false);
    setShowSuccessContent(false);
    setHideFooter(false);
    contentAnim.setValue(1);
    footerAnim.setValue(1);
    addressAnim.setValue(1);
    paymentAnim.setValue(1);
    successAnim.setValue(0);
    successContentAnim.setValue(0);
    footerPaddingAnim.setValue(footerHeight + 24);
  };

  const customFooter = (props: any) => {
    if (hideFooter) return null;
    return (
      <BottomSheetFooter {...props}>
        <Animated.View
          onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
          style={{
            paddingHorizontal: 16,
            paddingVertical: 12,
            backgroundColor: palette.surface,
            borderTopWidth: 1,
            borderColor: palette.border,
            gap: 10,
            opacity: footerAnim,
            // transform: [
            //   { translateX: footerAnim.interpolate({ inputRange: [0, 1], outputRange: [-200, 0] }) },
            // ],
          }}
        >
          <View style={{ gap: 5, position: 'relative' }}>
            <Text style={styles.sheetText}>
              {t("subtotal")}: {subtotal.toLocaleString()} SYP
            </Text>
            <Text style={styles.sheetText}>
              {t("deliveryFee")}: {deliveryFee?.toLocaleString()} SYP
            </Text>
            {/* {walletInsufficient && (
                <Text style={[styles.sheetText, { color: "red" }]}>
                  {t("balance")}: {walletBalance.toLocaleString()} SYP 
                </Text>
              )} */}

          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, (!selectedAddress || submitting || walletInsufficient) && { opacity: 0.8 }]}
            onPress={placeOrder}
            disabled={!selectedAddress || submitting || walletInsufficient}
          >
            <Text style={styles.primaryBtnText}>
              {submitting ? t("placingOrder") : t("placeOrder")}
              {!submitting && ` - ${orderTotal.toLocaleString()} ${t('syp')}`}
            </Text>
            {submitting && <ActivityIndicator color={'#fff'} size={'small'} style={{}} />}
          </TouchableOpacity>
        </Animated.View>
      </BottomSheetFooter>
    );
  };
  return (
    <BottomSheetModalProvider>
      <Screen>
        <Text weight="bold" style={styles.title}>{t("cart")}</Text>

        {items.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text weight="bold" style={styles.emptyTitle}>{t("emptyCartTitle") ?? "Your cart is empty"}</Text>
            <Text style={styles.emptyText}>{t("emptyCartCopy") ?? "Add items to your cart to see them here."}</Text>

            <TouchableOpacity style={styles.browseBtn} onPress={() => { router.replace("/(tabs)/store") }}>
              <Text weight="bold" style={styles.browseBtnText}>{t("startBrowsing") ?? "Start browsing"}</Text>
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
                  <Text weight="bold" style={styles.name}>{item.name}</Text>
                  <Text style={styles.muted}>
                    {item.price.toLocaleString()} SYP
                  </Text>
                </View>
                <View style={styles.qtyRow}>
                  <View style={styles.qtyRow}>
                    <TouchableOpacity style={styles.qtyButton} onPress={() => setQuantity(item.productId, item.quantity - 1)}>
                      <Text weight="bold" style={styles.qtySymbol}>-</Text>
                    </TouchableOpacity>
                    <Text weight="bold" style={styles.qtyValue}>{item.quantity}</Text>
                    <TouchableOpacity style={styles.qtyButton} onPress={() => setQuantity(item.productId, item.quantity + 1)}>
                      <Text weight="bold" style={styles.qtySymbol}>+</Text>
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
          <Text weight="bold" style={styles.totalValue}>{subtotal.toLocaleString()} SYP</Text>
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
          <Text weight="bold" style={styles.sheetTitle}>{t("confirmRemove") ?? "Remove item?"}</Text>
          <Text style={styles.sheetText}>{t("confirmRemoveCopy") ?? "Are you sure you want to remove this item from your cart?"}</Text>
          <TouchableOpacity style={styles.checkRow} onPress={toggleSkip}>
            <View style={[styles.checkbox, skipConfirm && styles.checkboxChecked]}>
              {skipConfirm ? <Text weight="bold" style={styles.checkboxMark}>X</Text> : null}
            </View>
            <Text weight="bold" style={styles.checkLabel}>{t("dontAskAgain") ?? "Don't ask again"}</Text>
          </TouchableOpacity>
          <View style={styles.sheetActions}>
            <TouchableOpacity style={[styles.sheetButton, styles.sheetButtonSecondary]} onPress={handleCancel}>
              <Text weight="bold" style={styles.sheetButtonTextSecondary}>{t("no") ?? "No"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.sheetButton, styles.sheetButtonPrimary]} onPress={handleRemoveConfirmed}>
              <Text weight="bold" style={styles.sheetButtonTextPrimary}>{t("yes") ?? "Yes"}</Text>
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
          <Text weight="bold" style={styles.sheetTitle}>{t("confirmClearCart") ?? "Clear cart?"}</Text>
          <Text style={[styles.sheetText, { marginBottom: 20 }]}>{t("confirmClearCartCopy") ?? "This will remove all items from your cart."}</Text>
          <View style={styles.sheetActions}>
            <TouchableOpacity style={[styles.sheetButton, styles.sheetButtonSecondary]} onPress={() => clearSheetRef.current?.dismiss()}>
              <Text weight="bold" style={styles.sheetButtonTextSecondary}>{t("no") ?? "No"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.sheetButton, styles.sheetButtonPrimary]} onPress={handleClearConfirmed}>
              <Text weight="bold" style={styles.sheetButtonTextPrimary}>{t("yes") ?? "Yes"}</Text>
            </TouchableOpacity>
          </View>
        </BottomSheetView>
      </BottomSheetModal>

      <BottomSheetModal
        ref={checkoutSheetRef}
        // snapPoints={checkoutSnapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        enableDynamicSizing
        maxDynamicContentSize={windowHeight * 0.8}
        footerComponent={customFooter}
        onDismiss={() => {
          setSubmitting(false);
          setCheckoutSuccess(false);
          setShowSuccessContent(false);
          setHideFooter(false);
          setSuccessOrderId(null);
        }}
        backgroundStyle={{ backgroundColor: palette.card, borderRadius: 20 }}
        handleIndicatorStyle={{ backgroundColor: palette.muted }}
      >
        <BottomSheetScrollView
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 0 }}
        >
          <Animated.View style={{ paddingBottom: footerPaddingAnim }}>
            {showSuccessContent && (
              <Animated.View
                style={[
                  styles.successWrap,
                  {
                    opacity: successContentAnim,
                    transform: [
                      { translateY: successContentAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) },
                    ],
                  },
                ]}
              >
                <Animated.View style={[
                  styles.successIcon,
                  {
                    transform: [{ scale: successAnim }],
                    opacity: successAnim,
                  },
                ]}>
                  <LottieView
                    ref={lottieRef}
                    loop={false}
                    style={{ width: 200, height: 200 }}
                    source={require("../assets/orderSuccess.json")}
                    onAnimationFinish={() => {
                      lottieRef.current?.play(145, 145);
                    }}
                  />
                </Animated.View>
                <Text weight="bold" style={styles.successTitle}>{t("orderPlaced") ?? "Order placed!"}</Text>
                <Text style={styles.successText}>{t("orderPlacedCopy") ?? "Your order is confirmed and on its way."}</Text>

                <TouchableOpacity style={[styles.primaryBtn, { width: '100%' }]} onPress={() => {
                  checkoutSheetRef.current?.dismiss();
                  if (successOrderId) {
                    router.push(`/orders/${successOrderId}`);
                  } else {
                    router.replace("/(tabs)/orders");
                  }
                }}>
                  <Text style={styles.primaryBtnText}>{t("trackOrder") ?? "Track order"}</Text>
                </TouchableOpacity>

              </Animated.View>
            )}

            {!showSuccessContent && (
              <Animated.View
                onLayout={(event) => setContentHeight(event.nativeEvent.layout.height)}
                style={{
                  opacity: contentAnim,
                  // transform: [
                  //   { translateX: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [80, 0] }) },
                  // ],
                }}
              >
                <Animated.View
                  style={{
                    opacity: contentAnim,
                    // transform: [
                    //   { translateX: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [-80, 0] }) },
                    // ],
                  }}
                >
                  <Text weight="bold" style={[styles.sheetTitle, { paddingTop: 16, paddingHorizontal: 16 }]}>{t("checkout")}</Text>
                </Animated.View>

                <Animated.View
                  style={{
                    marginBottom: 20,
                    paddingHorizontal: 16,
                    opacity: addressAnim,
                    // transform: [
                    //   { translateX: addressAnim.interpolate({ inputRange: [0, 1], outputRange: [-80, 0] }) },
                    // ],
                  }}
                >
                  <View style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: palette.surface,
                    padding: 10,
                    borderTopLeftRadius: 20,
                    borderTopRightRadius: 20, marginBottom: -2
                  }}>

                    <Text weight="medium" style={styles.section}>{t("address")}</Text>

                    {!showAddresses ? (
                      <TouchableOpacity style={styles.addressBtn} onPress={() => { setShowAddresses(true) }}>
                        <Text weight="bold" style={styles.addressBtnText}>{selectedAddress ? t("change") ?? "Change address" : t("addAddress") ?? "Add address"}</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <TouchableOpacity style={styles.addressBtn} onPress={() => { setShowAddresses(false) }}>
                          <Text weight="bold" style={styles.addressBtnText}>{t("cancel") ?? "Cancel"}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.addressBtn} onPress={() => { router.push("/addresses") }}>
                          <Text weight="bold" style={styles.addressBtnText}>{t("manageAddresses") ?? "Manage addresses"}</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>

                  {!showAddresses && selectedAddress &&
                    <View style={styles.addressBox}>
                      <View style={{
                        backgroundColor: "#fff",
                        padding: 10,
                        borderRadius: 20,
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <View>
                          <Text weight="bold" style={styles.addressLabel}>{selectedAddress.label}</Text>
                          <Text style={styles.addressText}>{selectedAddress.address}</Text>
                        </View>
                        <View style={{ alignItems: 'center' }}>
                          {distanceKm > 1 && <Text style={styles.oldDistance}>{distanceKm} Km</Text>}
                          <Text weight="bold" style={styles.distance}>{distanceKm > 1 ? Math.ceil(distanceKm - 1) : distanceKm} Km</Text>
                        </View>
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
                            {selectedAddress?._id === addr._id && <FontAwesome name="check" size={20} color={palette.accent} style={[styles.selectedTick, { right: 5 }]} />}
                            <Text weight="bold" style={styles.addressLabel}>{addr.label}</Text>
                            <Text style={styles.addressText}>{addr.address}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}

                </Animated.View>

                <Animated.View
                  style={{
                    paddingHorizontal: 16,
                    opacity: paymentAnim,
                    // transform: [
                    //   { translateX: paymentAnim.interpolate({ inputRange: [0, 1], outputRange: [-80, 0] }) },
                    // ],
                  }}
                >
                  <View style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: palette.surface,
                    padding: 10,
                    borderTopLeftRadius: 20,
                    borderTopRightRadius: 20,
                  }}>
                    <Text weight="medium" style={styles.section}>{t("paymentMethod") ?? "Payment"}</Text>
                    {!showPaymentOptions ? (
                      <TouchableOpacity style={styles.addressBtn} onPress={() => setShowPaymentOptions(true)}>
                        <Text weight="bold" style={styles.addressBtnText}>{t("change") ?? "Change"}</Text>
                      </TouchableOpacity>
                    ) :
                      <TouchableOpacity style={styles.addressBtn} onPress={() => setShowPaymentOptions(false)}>
                        <Text weight="bold" style={styles.addressBtnText}>{t("cancel") ?? "Cancel"}</Text>
                      </TouchableOpacity>
                    }
                  </View>

                  {!showPaymentOptions ? (
                    <View style={styles.addressBox}>
                      <View style={[styles.sheetText, {
                        backgroundColor: "#fff",
                        padding: 10,
                        borderRadius: 20
                      },
                      paymentMethod === "WALLET" && { flexDirection: 'row', justifyContent: 'space-between' },
                      ]}>
                        <Text weight="bold">{paymentMethod}</Text>

                        {paymentMethod === "WALLET" && (
                          <View style={{ flexDirection: 'row', gap: 5, alignItems: 'baseline' }}>
                            {walletInsufficient && <FontAwesome6 name="circle-exclamation" size={14} color="#ff5555" />}
                            <Text style={[{ fontWeight: '700' }, walletInsufficient && { color: '#ff5555' }]}>
                              {t("balance")}: {walletBalance.toLocaleString()} SYP
                            </Text>
                          </View>
                        )}
                      </View>
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
                            {paymentMethod === method && <FontAwesome name="check" size={20} color={palette.accent} style={[styles.selectedTick, { top: 10 }, { right: 5 }]} />}
                            <Text weight="bold" style={[styles.pillText, paymentMethod === method && styles.pillTextActive]}>{method}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}
                </Animated.View>
              </Animated.View>
            )}
          </Animated.View>

        </BottomSheetScrollView>
      </BottomSheetModal>
    </BottomSheetModalProvider>
  );
}

const createStyles = (palette: any, isRTL: boolean, isDark: boolean) =>
  StyleSheet.create({
    title: { color: palette.text, fontSize: 22, marginBottom: 12, textAlign: 'left' },
    row: {
      backgroundColor: palette.card,
      borderRadius: 20,
      padding: 12,
      borderWidth: 1,
      borderColor: palette.border,
      flexDirection: "row",
      justifyContent: "space-between",
    },
    name: { color: palette.text, textAlign: 'left' },
    muted: { color: palette.muted, textAlign: 'left' },
    link: { color: palette.accent },
    totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: 'center', marginVertical: 12 },
    totalLabel: { color: palette.muted },
    totalValue: { color: palette.text, fontSize: 16 },
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
    qtySymbol: { color: palette.text, fontSize: 18 },
    qtyValue: { color: palette.text, fontSize: 16, minWidth: 24, textAlign: "center" },
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
    emptyTitle: { color: palette.text, fontSize: 18 },
    emptyText: { color: palette.muted, textAlign: "center" },
    browseBtn: {
      backgroundColor: palette.accent,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 10,
      marginTop: 4,
    },
    browseBtnText: { color: "#fff" },
    sheetContainer: { padding: 16 },
    sheetTitle: { color: palette.text, fontSize: 18, marginBottom: 20, textAlign: 'left' },
    section: {
      fontSize: 14,
    },
    sheetText: { color: palette.muted, textAlign: 'left' },
    sheetActions: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
    sheetButton: {
      flex: 1, paddingBottom: 12,
      paddingTop: 12, borderRadius: 12, alignItems: "center", borderWidth: 1, borderColor: palette.border
    },
    sheetButtonSecondary: { backgroundColor: palette.surface },
    sheetButtonPrimary: { backgroundColor: palette.accent, borderColor: palette.accent },
    sheetButtonTextPrimary: { color: "#fff" },
    sheetButtonTextSecondary: { color: palette.text },
    checkRow: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 20 },
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
    checkboxMark: { color: palette.text },
    checkLabel: { color: palette.text, },
    addressBox: {
      gap: 4,
      borderBottomLeftRadius: 20,
      borderBottomRightRadius: 20,
      borderWidth: 4,
      borderColor: palette.surface,
      backgroundColor: palette.surface,
    },
    addressLabel: { color: palette.text, textAlign: 'left' },
    distance: {
      fontSize: 14,
      color: palette.text
    },
    oldDistance: {
      fontSize: 12,
      color: palette.text,
      textDecorationLine: "line-through",
    },
    addressText: { color: palette.text, textAlign: 'left' },
    addressBtn: {
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderRadius: 10,
      // borderWidth: 1,
      borderColor: palette.border,
      alignItems: "center",
      backgroundColor: palette.card,
    },
    addressBtnText: { color: palette.accent },
    pillRow: {
      padding: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: palette.border,
      // backgroundColor: palette.surface,
    },
    pillRowActive: { borderColor: palette.accent, position: 'relative', backgroundColor: isDark ? palette.surface : "rgba(249,115,22,0.10)", },
    selectedTick: { position: 'absolute', top: 5 },
    pillText: { color: palette.text, textAlign: 'left' },
    pillTextActive: { color: "#0f172a" },
    primaryBtn: {
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: "center",
      backgroundColor: palette.accent,
      shadowColor: palette.accent,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 5
    },
    primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: '700' },
    successWrap: {
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 15,
      paddingVertical: 12,
      gap: 10,
    },
    successIcon: {
      width: 120,
      height: 120,
      alignItems: "center",
      justifyContent: "center",
      // borderRadius: 60,
      // backgroundColor: "#16a34a",
      marginBottom: 6,
      // shadowColor: "#16a34a",
      // shadowOpacity: 0.35,
      // shadowRadius: 12,
      // shadowOffset: { width: 0, height: 6 },
      // elevation: 6,
    },
    successRing: {
      position: "absolute",
      width: 136,
      height: 136,
      borderRadius: 68,
      borderWidth: 2,
      borderColor: "rgba(22,163,74,0.35)",
    },
    successCheck: {
      width: 44,
      height: 22,
      borderLeftWidth: 6,
      borderBottomWidth: 6,
      borderColor: "#fff",
      transform: [{ rotate: "-45deg" }],
      marginTop: 4,
    },
    successTitle: { color: palette.text, fontSize: 20, textAlign: "center" },
    successText: { color: palette.muted, textAlign: "center" },
    debugRow: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 4,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    debugBtn: {
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.surface,
    },
    debugBtnText: { color: palette.muted, fontSize: 12 },
  });
