import { Link } from "expo-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { FlatList, Text, TextInput, View, StyleSheet, Image, TouchableOpacity, ActivityIndicator, Keyboard } from "react-native";
import { BottomSheetBackdrop, BottomSheetFooter, BottomSheetModal, BottomSheetModalProvider, BottomSheetView } from "@gorhom/bottom-sheet";
import Screen from "../components/Screen";
import api from "../lib/api";
import { useCart } from "../lib/cart";
import { useTheme } from "../lib/theme";
import { useI18n } from "../lib/i18n";
import Feather from "@expo/vector-icons/Feather";
import AntDesign from "@expo/vector-icons/AntDesign";
import { useAuth } from "../lib/auth";
import { useFocusEffect, useRouter } from "expo-router";
import { Pulse } from "../components/Pulse";
import { Shimmer } from "../components/Shimmer";
import { Skeleton } from "../components/Skeleton";
import ProgressBar from "../components/ProgressBar";

type Category = { _id: string; name: string; imageUrl?: string };
type Product = { _id: string; name: string; description: string; price: number; images: { url: string }[] };
type SortOption = "relevance" | "priceAsc" | "priceDesc";
type PriceFilter = "all" | "lt50k" | "lt100k" | "gte100k";
type SavedAddress = { _id: string; address: string; label?: string; updatedAt?: string; createdAt?: string };

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Product[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [sortOption, setSortOption] = useState<SortOption>("relevance");
  const [priceFilter, setPriceFilter] = useState<PriceFilter>("all");
  const [latestAddress, setLatestAddress] = useState<string | null>(null);
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [settings, setSettings] = useState<any>();
  const [wallet, setWallet] = useState<any>();
  const [membershipLoading, setMembershipLoading] = useState(false);
  const [membershipError, setMembershipError] = useState(false);
  const membershipLoadingRef = useRef(false);
  const sheetRef = useRef<BottomSheetModal>(null);
  const addressSheetRef = useRef<BottomSheetModal>(null);
  const membershipSheetRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ["80%"], []);
  const membershipSnapPoints = useMemo(() => ["45%"], []);
  const renderBackdrop = useCallback((props: any) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />, []);
  const customFooter = (props: any) => (
    <BottomSheetFooter {...props}>
      <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
        <TouchableOpacity style={styles.applyButton} onPress={closeSheet}>
          <Text style={styles.applyButtonText}>{t("apply") ?? "Apply"}</Text>
        </TouchableOpacity>
      </View>
    </BottomSheetFooter>
  );
  const { palette, isDark } = useTheme();
  const { items, addItem, setQuantity } = useCart();
  const { t, isRTL } = useI18n();
  const fetchMembershipMeta = useCallback(() => {
    if (!user || membershipLoadingRef.current) return;
    membershipLoadingRef.current = true;
    setMembershipLoading(true);
    setMembershipError(false);
    Promise.all([api.get("/wallet"), api.get("/settings")])
      .then(([walletRes, settingsRes]) => {
        setWallet(walletRes.data.data.wallet);
        setSettings(settingsRes.data.data);
      })
      .catch(() => setMembershipError(true))
      .finally(() => {
        membershipLoadingRef.current = false;
        setMembershipLoading(false);
      });
  }, [user]);
  const membershipLevel = user?.membershipLevel || "None";
  const membershipTone = useMemo(() => {
    const tones: Record<string, { background: string; badgeBg: string; badgeText: string }> = {
      None: { background: palette.surface, badgeBg: palette.card, badgeText: palette.text },
      Silver: { background: "#eef2ff", badgeBg: "#e0e7ff", badgeText: "#4338ca" },
      Gold: { background: "#fff7ed", badgeBg: "#ffedd5", badgeText: "#b45309" },
      Platinum: { background: "#f1f5f9", badgeBg: "#e2e8f0", badgeText: "#0f172a" },
      Diamond: { background: "#ecfeff", badgeBg: "#cffafe", badgeText: "#0891b2" },
    };
    const base = tones[membershipLevel] || tones.None;
    if (isDark) {
      return { background: palette.surface, badgeBg: palette.card, badgeText: palette.text };
    }
    return base;
  }, [membershipLevel, isDark, palette]);
  const thresholds = settings?.membershipThresholds || { silver: 1000000, gold: 2000000, platinum: 4000000, diamond: 6000000 };
  const balance = wallet?.balance || 0;
  const graceDays = settings?.membershipGraceDays ?? 14;
  const { nextLabel, remaining, progress } = useMemo(() => {
    const levels = [
      { name: "None", min: 0 },
      { name: "Silver", min: thresholds.silver },
      { name: "Gold", min: thresholds.gold },
      { name: "Platinum", min: thresholds.platinum },
      { name: "Diamond", min: thresholds.diamond },
    ];
    const currentIdx = levels.findIndex((l) => l.name === membershipLevel);
    const next = levels[currentIdx + 1];
    if (!next) return { nextLabel: "Max", remaining: 0, progress: 1 };
    const remaining = Math.max(0, next.min - balance);
    const range = next.min - levels[currentIdx].min || 1;
    const progress = Math.min(1, (balance - levels[currentIdx].min) / range);
    return { nextLabel: next.name, remaining, progress };
  }, [balance, membershipLevel, thresholds]);
  const loadLatestAddress = useCallback(() => {
    if (!user) {
      setLatestAddress(null);
      setAddresses([]);
      return;
    }
    api
      .get("/addresses")
      .then((res) => {
        const list: SavedAddress[] = res.data.data || [];
        const sorted = [...list].sort(
          (a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime()
        );
        setAddresses(sorted);
        setLatestAddress(sorted[0]?.address || null);
      })
      .catch(() => {
        setLatestAddress(null);
        setAddresses([]);
      });
  }, [user]);
  const styles = useMemo(() => createStyles(palette, isRTL), [palette, isRTL]);
  const fallbackLogo = isDark ? require("../assets/shopico_logo.png") : require("../assets/shopico_logo-black.png");

  useEffect(() => {
    api.get("/categories").then((res) => setCategories(res.data.data || []));
    api.get("/products").then((res) => setProducts(res.data.data || []));
  }, []);

  useEffect(() => {
    if (user) {
      fetchMembershipMeta();
    } else {
      setWallet(undefined);
      setSettings(undefined);
    }
  }, [user, fetchMembershipMeta]);

  useFocusEffect(
    useCallback(() => {
      loadLatestAddress();
    }, [loadLatestAddress])
  );

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(handle);
  }, [search]);

  useEffect(() => {
    if (!debouncedSearch) {
      setSearchResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const url = `/products?q=${encodeURIComponent(debouncedSearch)}`;
    api
      .get(url)
      .then((res) => setSearchResults(res.data.data || []))
      .catch(() => setSearchResults([]))
      .finally(() => setSearching(false));
  }, [debouncedSearch]);

  const hasQuery = debouncedSearch.length > 0;
  const visibleProducts = hasQuery ? searchResults ?? products : products;
  const filteredAndSorted = useMemo(() => {
    let list = visibleProducts;
    if (priceFilter !== "all") {
      list = list.filter((p) => {
        if (priceFilter === "lt50k") return p.price < 50000;
        if (priceFilter === "lt100k") return p.price < 100000;
        return p.price >= 100000;
      });
    }
    const result = [...list];
    if (sortOption === "priceAsc") result.sort((a, b) => a.price - b.price);
    if (sortOption === "priceDesc") result.sort((a, b) => b.price - a.price);
    return result;
  }, [visibleProducts, priceFilter, sortOption]);

  const openSheet = () => sheetRef.current?.present();
  const closeSheet = () => sheetRef.current?.dismiss();
  const openAddressSheet = () => {
    if (!user) return;
    loadLatestAddress();
    addressSheetRef.current?.present();
  };
  const openMembershipSheet = () => {
    if (!user) return;
    membershipSheetRef.current?.present();
    if (!wallet || !settings) fetchMembershipMeta();
  };

  return (
    <BottomSheetModalProvider>
      <Screen>
        <View style={styles.hero}>
          <Text style={styles.title}>{user ? `${t("hello")} ${user.name}` : t("helloShopper")}</Text>
          {user ? (
            <TouchableOpacity onPress={openAddressSheet}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10 }}>
                <Text
                  style={styles.subtitle}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {t("deliveryTo") ?? "Delivery to"}{" "}
                </Text>

                {latestAddress ? (
                  <Text
                    style={styles.subtitle}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {latestAddress}
                  </Text>
                ) : (
                  // <Pulse width={120} height={14} colorScheme={isDark ? "dark" : "light"} />
                  // <Shimmer width={150} height={14} colorScheme={isDark ? "dark" : "light"} />
                  <Skeleton width={150} height={14} colorScheme={isDark ? "dark" : "light"} />
                )}
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => { router.push("/auth/login") }}>
              <Text style={[styles.subtitle, { marginBottom: 10 }]} numberOfLines={1} ellipsizeMode="tail">
                {t("loginToLoadLocation") ?? "Login to load your location"} {t("login")}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        {user ? (
          <TouchableOpacity style={[styles.membershipCard, { backgroundColor: membershipTone.background }]} activeOpacity={0.9} onPress={openMembershipSheet}>
            <View style={styles.membershipTextBlock}>
              <View style={[styles.membershipDetailRow, { justifyContent: 'flex-start', gap: 20, alignItems: 'center' }]}>
                <View style={[styles.membershipBadge, { backgroundColor: membershipTone.badgeBg, borderColor: palette.border }]}>
                  <Feather name="award" size={22} color={membershipTone.badgeText} />
                  <Text style={[styles.membershipBadgeText, { color: membershipTone.badgeText }]}>{t("level")}</Text>
                </View>
                <View>
                  <Text style={styles.membershipLabel}>{t("membership")}</Text>
                  <Text style={[styles.membershipLevel, { color: membershipTone.badgeText }]}>{membershipLevel == "None" ? "Standard" : membershipLevel}</Text>
                </View>
              </View>
              {/* <Text style={styles.membershipCopy}>{t("loginSubhead")}</Text> */}
              <View style={{ gap: 8 }}>
                <View style={[styles.membershipDetailRow]}>
                  <View style={[styles.membershipDetailRow, { justifyContent: 'flex-start', gap: 5, alignItems: 'baseline' }]}>
                    <Text style={styles.sheetLabel}>{t("remainingToNext")}</Text>
                    <Text style={styles.sheetValue}>{nextLabel}</Text>
                  </View>
                  <Text style={styles.sheetText}>
                    {remaining > 0 ? `${remaining.toLocaleString()} SYP` : t("congrats") ?? "At top level"}
                  </Text>
                </View>
                <ProgressBar progress={progress} />
              </View>
            </View>
          </TouchableOpacity>
        ) : null}
        <View style={styles.searchWrapper}>
          <TextInput
            style={styles.search}
            placeholder={t("searchProducts")}
            placeholderTextColor={palette.muted}
            value={search}
            onChangeText={setSearch}
          />
          <Feather name="search" size={24} color={isDark ? "white" : "black"} style={styles.searchIcon} />
          {searching ? (
            <ActivityIndicator size="small" color={palette.accent} style={styles.searchSpinner} />
          ) : (
            search.trim() && <AntDesign name="close" size={20} color={isDark ? "white" : "black"} style={styles.searchSpinner} onPress={() => { setSearch(""); Keyboard.dismiss(); }} />
          )}
        </View>
        <View style={styles.filterRow}>
          <TouchableOpacity style={styles.filterChip} onPress={openSheet}>
            <Feather name="sliders" size={16} color={palette.text} />
            <Text style={styles.filterChipText}>{t("filters") ?? "Filters & Sort"}</Text>
          </TouchableOpacity>
          {(priceFilter !== "all" || sortOption !== "relevance") && (
            <TouchableOpacity
              onPress={() => {
                setPriceFilter("all");
                setSortOption("relevance");
              }}
            >
              <Text style={styles.reset}>{t("clear") ?? "Reset"}</Text>
            </TouchableOpacity>
          )}
        </View>
        {!hasQuery && (
          <>
            <View style={styles.sectionRow}>
              <Text style={styles.section}>{t("featuredCategories")}</Text>
              <Link href="/categories" asChild>
                <TouchableOpacity>
                  <Text style={styles.viewAll}>{t("viewAll") ?? "View all"}</Text>
                </TouchableOpacity>
              </Link>
            </View>
            <FlatList
              data={categories}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              style={{ flexGrow: 0 }}
              keyExtractor={(c) => c._id}
              contentContainerStyle={{ gap: 10 }}
              renderItem={({ item }) => (
                <Link href={{ pathname: `/categories/${item._id}`, params: { name: item.name } }} asChild>
                  <TouchableOpacity style={styles.categoryCard}>
                    <View style={styles.catImgContainer}>
                      <Image source={item.imageUrl ? { uri: item.imageUrl } : fallbackLogo} style={styles.categoryImg} />
                    </View>
                    <Text style={styles.chipText}>{item.name}</Text>
                  </TouchableOpacity>
                </Link>
              )}
            />
          </>
        )}
        <Text style={styles.section}>{hasQuery ? `${t("products")} (${filteredAndSorted.length})` : t("freshPicks")}</Text>
        <FlatList
          data={filteredAndSorted}
          numColumns={2}
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          keyExtractor={(p) => p._id}
          style={{ flexGrow: 0 }}
          columnWrapperStyle={{ gap: 20 }}
          renderItem={({ item }) => (
            <View style={styles.product}>
              <Link href={`/products/${item._id}`} asChild>
                <TouchableOpacity style={styles.productPressable}>
                  <View style={styles.prodImgContainer}>
                    <Image source={item.images?.[0]?.url ? { uri: item.images?.[0]?.url } : fallbackLogo} style={styles.productImg} />
                  </View>
                  <Text style={styles.productName}>{item.name}</Text>
                  <Text style={styles.productDescription}>{item.description}</Text>
                  <Text style={styles.productPrice}>{item.price.toLocaleString()} SYP</Text>
                </TouchableOpacity>
              </Link>
              {(() => {
                const existing = items.find((i) => i.productId === item._id);
                if (existing) {
                  return (
                    <View style={styles.qtyRow}>
                      <TouchableOpacity style={styles.qtyButton} onPress={() => setQuantity(existing.productId, existing.quantity - 1)}>
                        <Text style={styles.qtySymbol}>-</Text>
                      </TouchableOpacity>
                      <Text style={styles.qtyValue}>{existing.quantity}</Text>
                      <TouchableOpacity style={styles.qtyButton} onPress={() => addItem({ productId: item._id, name: item.name, price: item.price, image: item.images?.[0]?.url, quantity: 1 })}>
                        <Text style={styles.qtySymbol}>+</Text>
                      </TouchableOpacity>
                    </View>
                  );
                }
                return (
                  <TouchableOpacity style={styles.addButton} onPress={() => addItem({ productId: item._id, name: item.name, price: item.price, image: item.images?.[0]?.url, quantity: 1 })}>
                    <Text style={styles.addButtonText}>{t("addToCart")}</Text>
                  </TouchableOpacity>
                );
              })()}
            </View>
          )}
        />
        {hasQuery ? <Text style={styles.searchMeta}>{filteredAndSorted.length === 0 && t("emptyProducts")}</Text> : null}
      </Screen>

      <BottomSheetModal
        ref={sheetRef}
        snapPoints={snapPoints}
        enablePanDownToClose
        onDismiss={closeSheet}
        backdropComponent={renderBackdrop}
        footerComponent={customFooter}
        backgroundStyle={{ backgroundColor: palette.card }}
        handleIndicatorStyle={{ backgroundColor: palette.muted }}
      >
        <BottomSheetView style={styles.sheetContainer}>
          <View style={styles.sheetContent}>
            <Text style={styles.sheetTitle}>{t("filters") ?? "Filters & Sort"}</Text>
            <Text style={styles.sheetLabel}>{t("sortBy") ?? "Sort by"}</Text>
            <View style={styles.sheetRow}>
              {[
                { id: "relevance", label: t("relevance") ?? "Relevance" },
                { id: "priceAsc", label: t("priceLowHigh") ?? "Price: Low to High" },
                { id: "priceDesc", label: t("priceHighLow") ?? "Price: High to Low" },
              ].map((opt) => (
                <TouchableOpacity key={opt.id} style={[styles.sheetPill, sortOption === opt.id && styles.sheetPillActive]} onPress={() => setSortOption(opt.id as SortOption)}>
                  <Text style={styles.sheetPillText}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.sheetLabel}>{t("price") ?? "Price"}</Text>
            <View style={styles.sheetRow}>
              {[
                { id: "all", label: t("all") ?? "All" },
                { id: "lt50k", label: t("under50k") ?? "Under 50K" },
                { id: "lt100k", label: t("under100k") ?? "Under 100K" },
                { id: "gte100k", label: t("over100k") ?? "100K +" },
              ].map((opt) => (
                <TouchableOpacity key={opt.id} style={[styles.sheetPill, priceFilter === opt.id && styles.sheetPillActive]} onPress={() => setPriceFilter(opt.id as PriceFilter)}>
                  <Text style={styles.sheetPillText}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </BottomSheetView>
      </BottomSheetModal>
      <BottomSheetModal
        ref={addressSheetRef}
        snapPoints={["50%"]}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
      >
        <BottomSheetView style={styles.sheetContainer}>
          <Text style={styles.sheetTitle}>{t("deliveryTo") ?? "Delivery to"}</Text>
          {addresses.length === 0 ? (
            <Text style={styles.sheetText}>{t("noAddresses") ?? "No addresses saved yet."}</Text>
          ) : (
            addresses.map((addr) => (
              <TouchableOpacity
                key={addr._id}
                style={[styles.sheetPillRow, latestAddress === addr.address && styles.sheetPillRowActive]}
                onPress={() => {
                  setLatestAddress(addr.address);
                  addressSheetRef.current?.dismiss();
                }}
              >
                <Text style={styles.sheetPillText}>{addr.label || t("address")}</Text>
                <Text style={styles.sheetText}>{addr.address}</Text>
              </TouchableOpacity>
            ))
          )}
          <TouchableOpacity style={styles.addressBtn} onPress={() => { addressSheetRef.current?.dismiss(); }}>
            <Text style={styles.addressBtnText}>{t("close") ?? "Close"}</Text>
          </TouchableOpacity>
        </BottomSheetView>
      </BottomSheetModal>
      <BottomSheetModal
        ref={membershipSheetRef}
        snapPoints={membershipSnapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: palette.card }}
        handleIndicatorStyle={{ backgroundColor: palette.muted }}
      >
        <BottomSheetView style={styles.sheetContainer}>
          <Text style={styles.sheetTitle}>{t("membership")}</Text>
          {membershipLoading ? (
            <View style={{ paddingVertical: 10 }}>
              <ActivityIndicator color={palette.accent} />
            </View>
          ) : membershipError ? (
            <Text style={styles.sheetText}>Could not load membership details.</Text>
          ) : (
            <View style={{ gap: 12 }}>
              <View style={styles.membershipDetailRow}>
                <Text style={styles.sheetLabel}>{t("level")}</Text>
                <Text style={styles.sheetValue}>{membershipLevel}</Text>
              </View>
              <View style={styles.membershipDetailRow}>
                <Text style={styles.sheetLabel}>{t("balance")}</Text>
                <Text style={styles.sheetValue}>{balance.toLocaleString()} SYP</Text>
              </View>
              <View style={{ gap: 8 }}>
                <View style={styles.membershipDetailRow}>
                  <Text style={styles.sheetLabel}>{t("remainingToNext")}</Text>
                  <Text style={styles.sheetValue}>{nextLabel}</Text>
                </View>
                <ProgressBar progress={progress} />
                <Text style={styles.sheetText}>
                  {remaining > 0 ? `${remaining.toLocaleString()} SYP` : t("congrats") ?? "At top level"}
                </Text>
              </View>
              <Text style={styles.sheetText}>
                {t("graceDays")}: {graceDays}
              </Text>
            </View>
          )}
        </BottomSheetView>
      </BottomSheetModal>
    </BottomSheetModalProvider>
  );
}

const createStyles = (palette: any, isRTL: boolean) =>
  StyleSheet.create({
    hero: { gap: 6, marginBottom: 8 },
    title: { color: palette.text, fontSize: 26, fontWeight: "800", textAlign: isRTL ? "right" : "left" },
    subtitle: {
      color: palette.muted,
      fontSize: 14,
      textAlign: isRTL ? "right" : "left",
      // marginBottom: 10,
    },
    search: {
      backgroundColor: palette.card,
      borderRadius: 14,
      padding: 14,
      paddingLeft: 40,
      color: palette.text,
      marginBottom: 12,
      paddingRight: 40,
    },
    section: { color: palette.text, fontWeight: "700", marginVertical: 12, textAlign: isRTL ? "right" : "left" },
    searchMeta: { color: palette.muted, marginTop: 8, textAlign: isRTL ? "right" : "left" },
    searchWrapper: { position: "relative" },
    searchSpinner: { position: "absolute", right: 12, top: 12 },
    searchIcon: { position: "absolute", left: 10, top: 12 },
    sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginVertical: 12 },
    viewAll: { color: palette.accent, fontWeight: "700" },
    filterRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
    filterChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: palette.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.border,
    },
    membershipCard: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: palette.border,
      marginTop: 6,
      marginBottom: 10,
      gap: 14,
    },
    membershipTextBlock: { flex: 1, gap: 4 },
    membershipLabel: { color: palette.muted, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, fontSize: 12, textAlign: isRTL ? "right" : "left" },
    membershipLevel: { fontSize: 20, fontWeight: "800", textAlign: isRTL ? "right" : "left" },
    membershipCopy: { color: palette.muted, fontSize: 13, textAlign: isRTL ? "right" : "left" },
    membershipBadge: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      minWidth: 76,
    },
    membershipBadgeText: { fontWeight: "700", fontSize: 12 },
    filterChipText: { color: palette.text, fontWeight: "700" },
    reset: { color: palette.accent, fontWeight: "700" },
    categoryCard: {
      backgroundColor: palette.card,
      padding: 5,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.border,
      width: 120,
      alignItems: "center",
      gap: 6,
    },
    catImgContainer: {
      backgroundColor: palette.surface,
      borderRadius: 12,
      overflow: "hidden",
      padding: 5,
      width: "100%",
      height: 96,
      justifyContent: "center",
      alignItems: "center",
    },
    categoryImg: { height: 91, objectFit: "contain", aspectRatio: 1 },
    chipText: { color: palette.text, textAlign: "center" },
    product: {
      width: 180,
      backgroundColor: palette.card,
      borderRadius: 14,
      padding: 5,
      borderWidth: 1,
      borderColor: palette.border,
      shadowColor: palette.border,
      shadowOpacity: 0.12,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      gap: 10,
    },
    prodImgContainer: {
      backgroundColor: palette.surface,
      borderRadius: 12,
      overflow: "hidden",
      width: "100%",
      height: 96,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 10,
    },
    productImg: { height: 86, aspectRatio: 4 / 3, objectFit: "contain" },
    productName: { color: palette.text, fontWeight: "700" },
    productDescription: { color: palette.text, marginBottom: 20 },
    productPrice: { color: palette.accent },
    addButton: { backgroundColor: palette.accent, borderRadius: 10, paddingVertical: 10, alignItems: "center" },
    addButtonText: { color: "#fff", fontWeight: "700" },
    qtyRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    qtyButton: {
      width: 38,
      height: 38,
      borderRadius: 10,
      backgroundColor: palette.surface,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: palette.border,
    },
    qtySymbol: { color: palette.text, fontSize: 18, fontWeight: "800" },
    qtyValue: { color: palette.text, fontSize: 16, fontWeight: "800", minWidth: 24, textAlign: "center" },
    sheetContainer: { paddingHorizontal: 16, paddingBottom: 100, flex: 1 },
    sheetContent: { flex: 1, gap: 6 },
    sheetTitle: { paddingTop: 10, color: palette.text, fontSize: 18, fontWeight: "800", marginBottom: 10 },
    sheetLabel: { color: palette.muted, fontWeight: "700", marginTop: 8, marginBottom: 6 },
    sheetRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    sheetPill: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface },
    sheetPillActive: { borderColor: palette.accent, backgroundColor: palette.accentSoft },
    sheetPillText: { color: palette.text, fontWeight: "700" },
    sheetFooter: { paddingTop: 8 },
    sheetText: { color: palette.muted },
    sheetValue: { color: palette.text, fontWeight: "800" },
    applyButton: { backgroundColor: palette.accent, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
    applyButtonText: { color: "#fff", fontWeight: "800" },
    sheetPillRow: {
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.border,
      marginBottom: 8,
      backgroundColor: palette.surface,
      gap: 4,
    },
    sheetPillRowActive: { borderColor: palette.accent, backgroundColor: palette.accentSoft },
    membershipDetailRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    addressBtn: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: palette.border,
      alignItems: "center",
      backgroundColor: palette.card,
      marginTop: 4,
    },
    addressBtnText: { color: palette.accent, fontWeight: "700" },
  });
