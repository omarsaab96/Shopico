import { Link, useFocusEffect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  FlatList,
  TextInput,
  View,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Keyboard,
  Platform,
  Modal,
  ScrollView,
  useWindowDimensions,
  Linking,
} from "react-native";
import {
  BottomSheetBackdrop,
  BottomSheetFooter,
  BottomSheetModal,
  BottomSheetModalProvider,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import Screen from "../components/Screen";
import api from "../lib/api";
import { useCart } from "../lib/cart";
import { useTheme } from "../lib/theme";
import { useI18n } from "../lib/i18n";
import Feather from "@expo/vector-icons/Feather";
import AntDesign from "@expo/vector-icons/AntDesign";
import { useAuth } from "../lib/auth";
import { Skeleton } from "../components/Skeleton";
import ProgressBar from "../components/ProgressBar";
import Entypo from '@expo/vector-icons/Entypo';
import Text from "../components/Text";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from '@expo/vector-icons/Ionicons';

type Category = { _id: string; name: string; imageUrl?: string };
type Product = {
  _id: string;
  name: string;
  description: string;
  price: number;
  promoPrice?: number;
  isPromoted?: boolean;
  images: { url: string }[];
};
type SortOption = "relevance" | "priceAsc" | "priceDesc";
type PriceFilter = "all" | "lt50k" | "lt100k" | "gte100k";
type SavedAddress = { _id: string; address: string; label?: string; updatedAt?: string; createdAt?: string };
type Announcement = {
  _id: string;
  title?: string;
  description?: string;
  link?: string;
  image?: { url: string };
  startsAt?: string;
  endsAt?: string;
  isEnabled?: boolean;
};

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [sortOption, setSortOption] = useState<SortOption>("relevance");
  const [priceFilter, setPriceFilter] = useState<PriceFilter>("all");
  const [latestAddress, setLatestAddress] = useState<string | null>(null);
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [settings, setSettings] = useState<any>();
  const [wallet, setWallet] = useState<any>();
  const [membershipLoading, setMembershipLoading] = useState(false);
  const [membershipError, setMembershipError] = useState(false);
  const [profile, setProfile] = useState<any>(user);
  const [page, setPage] = useState(1);
  const searchInputRef = useRef<TextInput>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [showAnnouncements, setShowAnnouncements] = useState(false);
  const [promoIndex, setPromoIndex] = useState(0);

  const membershipLoadingRef = useRef(false);
  const sheetRef = useRef<BottomSheetModal>(null);
  const addressSheetRef = useRef<BottomSheetModal>(null);
  const membershipSheetRef = useRef<BottomSheetModal>(null);

  const snapPoints = useMemo(() => ["80%"], []);
  const membershipSnapPoints = useMemo(() => ["45%"], []);
  const renderBackdrop = useCallback(
    (props: any) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />,
    []
  );

  const { palette, isDark } = useTheme();
  const { items, addItem, setQuantity } = useCart();
  const { t, isRTL } = useI18n();

  const styles = useMemo(() => createStyles(palette, isRTL, isDark, insets), [palette, isRTL, isDark, insets]);

  const filterCount = useMemo(
    () => (priceFilter !== "all" ? 1 : 0) + (sortOption !== "relevance" ? 1 : 0),
    [priceFilter, sortOption]
  );

  const fallbackLogo = isDark ? require("../assets/shopico_logo.png") : require("../assets/shopico_logo-black.png");
  const promoWidth = Math.min(360, windowWidth - 32);
  const hasAnnouncements = announcements.length > 0;

  const customFooter = (props: any) => (
    <BottomSheetFooter {...props}>
      <View style={styles.sheetFooterWrap}>
        {(priceFilter !== "all" || sortOption !== "relevance") && (
          <TouchableOpacity
            style={[styles.sheetBtn, styles.sheetBtnGhost]}
            onPress={() => {
              setPriceFilter("all");
              setSortOption("relevance");
            }}
          >
            <Text style={[styles.sheetBtnText, styles.sheetBtnTextGhost]}>{t("clear") ?? "Reset"}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.sheetBtn} onPress={() => sheetRef.current?.dismiss()}>
          <Text style={styles.sheetBtnText}>{t("apply") ?? "Apply"}</Text>
        </TouchableOpacity>
      </View>
    </BottomSheetFooter>
  );

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

  useEffect(() => {
    setProfile(user);
    if (user) {
      api.get("/auth/me").then((res) => setProfile(res.data.data.user)).catch(() => { });
    }
  }, [user]);

  const membershipLevel = profile?.membershipLevel || "None";
  const graceUntil = profile?.membershipGraceUntil ? new Date(profile.membershipGraceUntil) : null;
  const inGrace = !!(graceUntil && graceUntil.getTime() > Date.now() && membershipLevel !== "None");

  const membershipTone = useMemo(() => {
    // “Card tone” for light mode (orange-first like the reference).
    // In dark mode we keep it calm and rely on palette colors.
    const tones: Record<string, { cardBg: string; accent: string; badgeBg: string; badgeText: string; ring: string }> = {
      None: { cardBg: "#f8fafc", accent: "#64748b", badgeBg: "#e2e8f0", badgeText: "#0f172a", ring: "#cbd5e1" },
      Silver: { cardBg: "#f7f7f7", accent: "#94a3b8", badgeBg: "#e2e8f0", badgeText: "#0f172a", ring: "#cbd5e1" },
      Gold: { cardBg: "#fff7ed", accent: "#ea9b2b", badgeBg: "#fef3c7", badgeText: "#92400e", ring: "#fcd34d" },
      Platinum: { cardBg: "#f4f4f5", accent: "#6b7280", badgeBg: "#e4e4e7", badgeText: "#27272a", ring: "#d4d4d8" },
      Diamond: { cardBg: "#f0f9ff", accent: "#0ea5e9", badgeBg: "#e0f2fe", badgeText: "#0c4a6e", ring: "#7dd3fc" },
    };

    const base = tones[membershipLevel] || tones.None;

    if (isDark) {
      return {
        cardBg: palette.card,
        accent: palette.accent,
        badgeBg: palette.surface,
        badgeText: palette.text,
        ring: palette.border,
      };
    }

    return base;
  }, [membershipLevel, isDark, palette]);

  const thresholds = settings?.membershipThresholds || {
    silver: 1000000,
    gold: 2000000,
    platinum: 4000000,
    diamond: 6000000,
  };

  const currentThreshold = useMemo(() => {
    const map: Record<string, number> = {
      Silver: thresholds.silver,
      Gold: thresholds.gold,
      Platinum: thresholds.platinum,
      Diamond: thresholds.diamond,
    };
    return map[membershipLevel] || 0;
  }, [membershipLevel, thresholds]);

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

  const fetchProducts = useCallback(
    (nextPage = 1, append = false) => {
      const params: Record<string, any> = { page: nextPage, limit: 20 };
      if (debouncedSearch) params.q = debouncedSearch;

      if (append) {
        setLoadingMore(true);
      } else if (nextPage === 1 && debouncedSearch.length === 0) {
        // Only show pull-to-refresh spinner for explicit refresh, not search.
        setRefreshing(true);
      } else {
        setLoadingProducts(true);
      }

      api
        .get("/products", { params })
        .then((res) => {
          const payload = res.data.data;
          const items = Array.isArray(payload) ? payload : payload?.items || [];
          const more = Array.isArray(payload) ? false : Boolean(payload?.hasMore);

          setProducts((prev) => (append ? [...prev, ...items] : items));
          setHasMore(more);
          setPage(nextPage);
        })
        .catch(() => {
          if (!append) setProducts([]);
          setHasMore(false);
        })
        .finally(() => {
          if (append) {
            setLoadingMore(false);
          } else if (nextPage === 1 && debouncedSearch.length === 0) {
            setRefreshing(false);
          } else {
            setLoadingProducts(false);
          }
        });
    },
    [debouncedSearch]
  );

  const loadLatestAddress = useCallback(() => {
    if (!user) {
      setLatestAddress(null);
      setAddresses([]);
      setRefreshing(false);
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
        setRefreshing(false);
      });
  }, [user]);

  useEffect(() => {
    api.get("/categories").then((res) => setCategories(res.data.data || []));
  }, []);

  useEffect(() => {
    api
      .get("/announcements/active")
      .then((res) => {
        const list = res.data.data || [];
        setAnnouncements(list);
        setPromoIndex(0);
        if (list.length > 0) setShowAnnouncements(true);
      })
      .catch(() => setAnnouncements([]));
  }, []);

  useEffect(() => {
    if (user) {
      fetchMembershipMeta();
    } else {
      setWallet(undefined);
      setSettings(undefined);
    }
  }, [user, fetchMembershipMeta]);

  useEffect(() => {
    fetchProducts(1, false);
  }, [debouncedSearch, fetchProducts]);

  useFocusEffect(
    useCallback(() => {
      loadLatestAddress();
    }, [loadLatestAddress])
  );

  const SEARCH_DEBOUNCE_MS = 600;

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [search]);

  

  const hasQuery = debouncedSearch.length > 0;
  const searching = loadingProducts && hasQuery;

  const filteredAndSorted = useMemo(() => {
    let list = products;
    if (priceFilter !== "all") {
      list = list.filter((p) => {
        const displayPrice = p.isPromoted && p.promoPrice !== undefined ? p.promoPrice : p.price;
        if (priceFilter === "lt50k") return displayPrice < 50000;
        if (priceFilter === "lt100k") return displayPrice < 100000;
        return displayPrice >= 100000;
      });
    }
    const result = [...list];
    if (sortOption === "priceAsc") {
      result.sort((a, b) => {
        const priceA = a.isPromoted && a.promoPrice !== undefined ? a.promoPrice : a.price;
        const priceB = b.isPromoted && b.promoPrice !== undefined ? b.promoPrice : b.price;
        return priceA - priceB;
      });
    }
    if (sortOption === "priceDesc") {
      result.sort((a, b) => {
        const priceA = a.isPromoted && a.promoPrice !== undefined ? a.promoPrice : a.price;
        const priceB = b.isPromoted && b.promoPrice !== undefined ? b.promoPrice : b.price;
        return priceB - priceA;
      });
    }
    return result;
  }, [products, priceFilter, sortOption]);

  const openSheet = () => sheetRef.current?.present();
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

  const handleLoadMore = () => {
    if (loadingMore || loadingProducts || !hasMore) return;
    fetchProducts(page + 1, true);
  };

  const renderTopBar = () => (
    <View style={styles.topBar}>
      <TouchableOpacity style={styles.iconBtn} onPress={() => router.push("/notifications")}>
        <Feather name="bell" size={20} color={palette.text} />
      </TouchableOpacity>

      <View style={styles.brandWrap}>
        <Image source={fallbackLogo} style={styles.brandLogo} />
      </View>

      <TouchableOpacity style={styles.iconBtn} onPress={() => router.push("/wallet")}>
        {/* <Feather name="user" size={20} color={palette.text} /> */}
        <Ionicons name="wallet-outline" size={20} color={palette.text} />
      </TouchableOpacity>
    </View>
  );

  const renderWalletCard = () => {
    if (!user) return null;
    if (hasQuery) return null;


    return (
      <TouchableOpacity activeOpacity={0.92} style={[styles.walletCard, { backgroundColor: membershipTone.cardBg }]} onPress={openMembershipSheet}>
        {/* “soft glow” like the reference */}
        <View style={[styles.walletGlowA, { backgroundColor: membershipTone.accent }]} />
        <View style={[styles.walletGlowB, { backgroundColor: membershipTone.accent }]} />

        <View style={styles.walletRow}>
          <View style={styles.walletTextCol}>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <Text style={styles.walletLabel}>{t("balance") ?? "Balance"}</Text>
                <Entypo name="info-with-circle" size={20} color={palette.muted} />
              </View>
              <View style={styles.walletBadgeRow}>
                <View style={[styles.levelPill, { backgroundColor: membershipTone.badgeBg, borderColor: membershipTone.ring }]}>
                  <Feather name="award" size={14} color={membershipTone.badgeText} />
                  <Text style={[styles.levelPillText, { color: membershipTone.badgeText }]}>
                    {membershipLevel === "None" ? (t("standard") ?? "Standard") : membershipLevel}
                  </Text>
                </View>
              </View>
            </View>
            <Text style={styles.walletValue}>
              {balance.toLocaleString()}<Text style={{ fontWeight: 400, fontSize: 14 }}> {t("syp")}</Text>
            </Text>
          </View>
        </View>

        <View style={{ marginTop: 10 }}>
          <ProgressBar progress={progress} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {remaining > 0 && <Text style={styles.walletMini}>
              <Text style={styles.walletMiniLabel}>{t("remainingToNext") ?? "Remaining"}</Text>
              <Text style={styles.walletMiniHint}>{nextLabel}</Text>
            </Text>}
            <Text style={styles.walletMiniValue}>
              {remaining > 0 ? `${remaining.toLocaleString()} ${t("syp")}` : (t("congrats") ?? "Top level")}
            </Text>
          </View>

          {inGrace && (
            <View style={[styles.graceBox, { borderColor: membershipTone.ring }]}>
              <Text style={styles.graceTitle}>{t("gracePeriodActive") ?? "Grace period active"}</Text>
              <Text style={styles.graceCopy}>
                {(t("graceKeepLevel") ?? "Keep your balance above")} {currentThreshold.toLocaleString()} {t("syp")}
              </Text>
              <Text style={styles.graceCopy}>
                {(t("graceUntil") ?? "Grace until")}: {graceUntil?.toLocaleDateString()}
              </Text>
            </View>
          )}

        </View>
      </TouchableOpacity>
    );
  };

  const renderSearchAndFilters = () => (
    <View style={styles.searchRow}>
      <View style={styles.searchWrap}>
        <Feather name="search" size={18} color={palette.muted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={t("searchProducts") ?? "Search products"}
          placeholderTextColor={palette.muted}
          value={search}
          ref={searchInputRef}
          onChangeText={(text) => {
            setSearch(text);
            searchInputRef.current?.focus();
          }}
          returnKeyType="search"
          onSubmitEditing={() => Keyboard.dismiss()}
        />
        {searching ? (
          <ActivityIndicator size="small" color={palette.accent} style={styles.searchRight} />
        ) : search.trim() ? (
          <TouchableOpacity
            style={styles.searchRight}
            onPress={() => {
              setSearch("");
            }}
          >
            <AntDesign name="close" size={18} color={palette.text} />
          </TouchableOpacity>
        ) : null}
      </View>

      <TouchableOpacity style={styles.filterBtn} onPress={openSheet} activeOpacity={0.9}>
        <Feather name="sliders" size={18} color={palette.accent} />
        {filterCount > 0 ? (
          <View style={styles.filterDot}>
            <Text style={styles.filterDotText}>{filterCount}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    </View>
  );

  const renderCategoriesGrid = () => {
    if (hasQuery) return null;

    return (
      <View style={{ gap: 10 }}>
        <View style={styles.sectionHead}>
          <Text weight="black" style={styles.sectionTitle}>{t("featuredCategories") ?? "Featured categories"}</Text>
          <Link href="/categories" asChild>
            <TouchableOpacity>
              <Text style={styles.sectionAction}>{t("viewAll") ?? "View all"}</Text>
            </TouchableOpacity>
          </Link>
        </View>

        <FlatList
          data={categories.slice(0, 6)}
          key={isRTL ? "rtl-cats" : "ltr-cats"}
          scrollEnabled={false}
          numColumns={3}
          columnWrapperStyle={styles.catRow}
          contentContainerStyle={{ gap: 12 }}
          keyExtractor={(c) => c._id}
          renderItem={({ item }) => (
            <Link href={{ pathname: `/categories/${item._id}`, params: { name: item.name } }} asChild>
              <TouchableOpacity style={styles.catCard} activeOpacity={0.9}>
                <View style={styles.catImgBox}>
                  {/* soft “frosted” look: blurred bg + icon-like image */}
                  {item.imageUrl ? (
                    <>
                      <Image source={{ uri: item.imageUrl }} style={styles.catBg} blurRadius={18} />
                      <View style={styles.catOverlay} />
                      <Image source={{ uri: item.imageUrl }} style={styles.catIcon} />
                    </>
                  ) : (
                    <>
                      <View style={styles.catOverlay} />
                      <Image source={fallbackLogo} style={[styles.catIcon, { tintColor: '#dedede' }]} />
                    </>
                  )}
                </View>
                <Text style={styles.catName} numberOfLines={1}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            </Link>
          )}
        />
      </View>
    );
  };

  const renderHeader = () => (
    <View style={[styles.headerWrap]}>
      {/* {renderTopBar()} */}


      {renderWalletCard()}
      {renderCategoriesGrid()}

      <Text weight="black" style={[styles.sectionTitle, { marginBottom: 10 }]}>
        {hasQuery ? `${t("products") ?? "Products"} (${filteredAndSorted.length})` : (t("freshPicks") ?? "Fresh picks")}
      </Text>
    </View>
  );

  return (
    <BottomSheetModalProvider>
      <Modal visible={showAnnouncements && hasAnnouncements} transparent animationType="fade">
        <View style={styles.promoBackdrop}>
          <View style={[styles.promoSheet, { width: promoWidth }]}>
            <View style={styles.promoHeader}>
              <Text style={styles.promoTitle}>{t("announcements") ?? "Announcements"}</Text>
              <TouchableOpacity onPress={() => setShowAnnouncements(false)} style={styles.promoClose}>
                <Text style={styles.promoCloseText}>{t("close") ?? "Close"}</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const nextIndex = Math.round(e.nativeEvent.contentOffset.x / promoWidth);
                setPromoIndex(nextIndex);
              }}
            >
              {announcements.map((announcement) => (
                <View key={announcement._id} style={[styles.promoSlide, { width: promoWidth }]}>
                  <View style={styles.promoImageWrap}>
                    {announcement.image?.url ? (
                      <Image source={{ uri: announcement.image.url }} style={styles.promoImage} />
                    ) : (
                      <Image source={fallbackLogo} style={styles.promoFallback} />
                    )}
                  </View>
                  <View style={styles.promoContent}>
                    {announcement.title ? <Text style={styles.promoHeadline}>{announcement.title}</Text> : null}
                    {announcement.description ? <Text style={styles.promoCopy}>{announcement.description}</Text> : null}
                  </View>
                  {announcement.link ? (
                    <TouchableOpacity
                      style={styles.promoLinkBtn}
                      onPress={() => {
                        Linking.openURL(announcement.link);
                      }}
                    >
                      <Text style={styles.promoLinkText}>{t("view") ?? "View"}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))}
            </ScrollView>
            {announcements.length > 1 ? (
              <View style={styles.promoDots}>
                {announcements.map((announcement, idx) => (
                  <View key={announcement._id} style={[styles.promoDot, idx === promoIndex && styles.promoDotActive]} />
                ))}
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
      {/* <StatusBar style={isDark ? "light" : "dark"} /> */}
      <View style={styles.safe}>
        <View style={styles.container}>
          <FlatList
            data={filteredAndSorted}
            numColumns={2}
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            keyboardShouldPersistTaps="handled"
            keyExtractor={(p) => p._id}
            contentContainerStyle={{ paddingBottom: 16, paddingHorizontal: 16 }}
            columnWrapperStyle={styles.productRow}
            ListHeaderComponent={
              <View>
                <View style={{ paddingHorizontal: 0,marginBottom:16,gap:10 }}>
                  {renderTopBar()}
                  <View style={styles.greetingWrap}>
                    <View style={styles.greetingCol}>
                      <Text style={styles.helloText}>
                        {user ? `${t("hello") ?? "Hello"}, ${user.name}` : (t("helloShopper") ?? "Hello shopper")}
                      </Text>

                      {user ? (
                        <TouchableOpacity onPress={openAddressSheet} activeOpacity={0.9} style={[styles.addressRow, { width: '100%' }]}>
                          <Feather name="map-pin" size={14} color={palette.muted} />
                          <Text style={styles.addressLabel} numberOfLines={1}>
                            {t("deliveryTo") ?? "Delivery to"}
                          </Text>

                          {latestAddress ? (
                            <>
                              <Text style={[styles.addressValue, { flex: 1 }]} numberOfLines={1}>
                                {latestAddress.substring(0, 52)}
                                <Entypo name="chevron-down" size={12} color="black" />
                              </Text>
                            </>
                          ) : (
                            <Skeleton width={150} height={14} colorScheme={isDark ? "dark" : "light"} />
                          )}
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          onPress={() => {
                            router.push("/auth/login");
                          }}
                          activeOpacity={0.9}
                          style={styles.addressRow}
                        >
                          <Feather name="log-in" size={14} color={palette.muted} />
                          <Text style={styles.addressValue} numberOfLines={1}>
                            {t("loginToLoadLocation") ?? "Login to load your location"} · {t("login") ?? "Login"}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                  {renderSearchAndFilters()}
                </View>
                {renderHeader()}
              </View>
            }
            refreshing={refreshing}
            onRefresh={() => fetchProducts(1, false)}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.4}
            renderItem={({ item, index }) => {
              const isLeft = index % 2 === 0;

              return (
                <View
                  style={{
                    width: "48%",
                  }}
                >
                  <View style={styles.productCard}>
                    <Link href={`/products/${item._id}`} asChild>
                      <TouchableOpacity
                        style={styles.productPressable}
                        activeOpacity={0.92}
                      >
                        <View style={styles.prodImgBox}>
                          <Image
                            source={
                              item.images?.[0]?.url
                                ? { uri: item.images?.[0]?.url }
                                : fallbackLogo
                            }
                            style={[
                              styles.productImg,
                              !item.images?.[0]?.url && { tintColor: '#dedede' },
                            ]}
                          />
                        </View>

                        <Text style={styles.productName} numberOfLines={1}>
                          {item.name}
                        </Text>

                        <Text style={styles.productDesc} numberOfLines={2}>
                          {item.description}
                        </Text>

                        <View style={styles.priceRow}>
                          {item.isPromoted && item.promoPrice !== undefined ? (
                            <Text style={styles.productOldPrice}>
                              {item.price.toLocaleString()} {t("syp")}
                            </Text>
                          ) : null}
                          <Text style={styles.productPrice}>
                            {(item.isPromoted && item.promoPrice !== undefined ? item.promoPrice : item.price).toLocaleString()} {t("syp")}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    </Link>

                    {(() => {
                      const existing = items.find(
                        (i) => i.productId === item._id
                      );

                      if (existing) {
                        return (
                          <View style={styles.qtyRow}>
                            <TouchableOpacity
                              style={styles.qtyBtn}
                              onPress={() =>
                                setQuantity(existing.productId, existing.quantity - 1)
                              }
                            >
                              <Text style={styles.qtySym}>-</Text>
                            </TouchableOpacity>

                            <Text style={styles.qtyVal}>{existing.quantity}</Text>

                            <TouchableOpacity
                              style={styles.qtyBtn}
                              onPress={() =>
                                addItem({
                                  productId: item._id,
                                  name: item.name,
                                  price: item.isPromoted && item.promoPrice !== undefined ? item.promoPrice : item.price,
                                  image: item.images?.[0]?.url,
                                  quantity: 1,
                                })
                              }
                            >
                              <Text style={styles.qtySym}>+</Text>
                            </TouchableOpacity>
                          </View>
                        );
                      }

                      return (
                        <TouchableOpacity
                          style={styles.addBtn}
                          onPress={() =>
                            addItem({
                              productId: item._id,
                              name: item.name,
                              price: item.isPromoted && item.promoPrice !== undefined ? item.promoPrice : item.price,
                              image: item.images?.[0]?.url,
                              quantity: 1,
                            })
                          }
                        >
                          <Text style={styles.addBtnText}>
                            {t("addToCart") ?? "Add to cart"}
                          </Text>
                        </TouchableOpacity>
                      );
                    })()}
                  </View>
                </View>
              );
            }}
            ListFooterComponent={
              <View style={{ paddingBottom: 0 }}>
                {loadingMore ? (
                  <View style={{ paddingVertical: 10 }}>
                    <ActivityIndicator color={palette.accent} />
                  </View>
                ) : null}
                {!loadingProducts && hasQuery && filteredAndSorted.length === 0 ? <Text style={styles.emptyText}>{t("emptyProducts") ?? "No products found."}</Text> : null}
              </View>
            }
          />

          {/* Filters */}
          <BottomSheetModal
            ref={sheetRef}
            snapPoints={snapPoints}
            enablePanDownToClose
            backdropComponent={renderBackdrop}
            footerComponent={customFooter}
            backgroundStyle={{ backgroundColor: palette.card, borderRadius: 20 }}
            handleIndicatorStyle={{ backgroundColor: palette.muted }}
          >
            <BottomSheetView style={styles.sheetContainer}>
              <View style={styles.sheetContent}>
                <Text style={styles.sheetTitle}>{t("filters") ?? "Filters & Sort"}</Text>

                <Text style={styles.sheetLabel}>{t("sortBy") ?? "Sort by"}</Text>
                <View style={styles.sheetPills}>
                  {[
                    { id: "relevance", label: t("relevance") ?? "Relevance" },
                    { id: "priceAsc", label: t("priceLowHigh") ?? "Price: Low to High" },
                    { id: "priceDesc", label: t("priceHighLow") ?? "Price: High to Low" },
                  ].map((opt) => (
                    <TouchableOpacity
                      key={opt.id}
                      style={[styles.pill, sortOption === opt.id && styles.pillActive]}
                      onPress={() => setSortOption(opt.id as SortOption)}
                      activeOpacity={0.9}
                    >
                      <Text style={[styles.pillText, sortOption === opt.id && styles.pillTextActive]}>{opt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.sheetLabel}>{t("price") ?? "Price"}</Text>
                <View style={styles.sheetPills}>
                  {[
                    { id: "all", label: t("all") ?? "All" },
                    { id: "lt50k", label: t("under50k") ?? "Under 50K" },
                    { id: "lt100k", label: t("under100k") ?? "Under 100K" },
                    { id: "gte100k", label: t("over100k") ?? "100K +" },
                  ].map((opt) => (
                    <TouchableOpacity
                      key={opt.id}
                      style={[styles.pill, priceFilter === opt.id && styles.pillActive]}
                      onPress={() => setPriceFilter(opt.id as PriceFilter)}
                      activeOpacity={0.9}
                    >
                      <Text style={[styles.pillText, priceFilter === opt.id && styles.pillTextActive]}>{opt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </BottomSheetView>
          </BottomSheetModal>

          {/* Addresses */}
          <BottomSheetModal
            ref={addressSheetRef}
            snapPoints={["50%"]}
            enablePanDownToClose
            backdropComponent={renderBackdrop}
            backgroundStyle={{ backgroundColor: palette.card, borderRadius: 20 }}
          >
            <BottomSheetView style={styles.sheetContainer}>
              <Text style={styles.sheetTitle}>{t("deliveryTo") ?? "Delivery to"}</Text>
              {addresses.length === 0 ? (
                <Text style={styles.sheetText}>{t("noAddresses") ?? "No addresses saved yet."}</Text>
              ) : (
                addresses.map((addr) => (
                  <TouchableOpacity
                    key={addr._id}
                    style={[styles.addressItem, latestAddress === addr.address && styles.addressItemActive]}
                    onPress={() => {
                      setLatestAddress(addr.address);
                      addressSheetRef.current?.dismiss();
                    }}
                    activeOpacity={0.9}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Text style={styles.addressTitle}>{addr.label || (t("address") ?? "Address")}</Text>
                      {latestAddress === addr.address ? <Feather name="check" size={18} color={palette.accent} /> : null}
                    </View>
                    <Text style={styles.sheetText}>{addr.address}</Text>
                  </TouchableOpacity>
                ))
              )}

              <TouchableOpacity style={styles.closeBtn} onPress={() => addressSheetRef.current?.dismiss()} activeOpacity={0.9}>
                <Text style={styles.closeBtnText}>{t("close") ?? "Close"}</Text>
              </TouchableOpacity>
            </BottomSheetView>
          </BottomSheetModal>

          {/* Membership */}
          <BottomSheetModal
            ref={membershipSheetRef}
            snapPoints={membershipSnapPoints}
            enablePanDownToClose
            backdropComponent={renderBackdrop}
            backgroundStyle={{ backgroundColor: palette.card, borderRadius: 20 }}
            handleIndicatorStyle={{ backgroundColor: palette.muted }}
          >
            <BottomSheetView style={styles.sheetContainer}>
              <Text style={styles.sheetTitle}>{t("membership") ?? "Membership"}</Text>

              {membershipLoading ? (
                <View style={{ paddingVertical: 10 }}>
                  <ActivityIndicator color={palette.accent} />
                </View>
              ) : membershipError ? (
                <Text style={styles.sheetText}>Could not load membership details.</Text>
              ) : (
                <View style={{ gap: 12 }}>
                  <View style={styles.kvRow}>
                    <Text style={styles.kvLabel}>{t("level") ?? "Level"}</Text>
                    <Text style={styles.kvValue}>{membershipLevel === "None" ? (t("standard") ?? "Standard") : membershipLevel}</Text>
                  </View>

                  <View style={styles.kvRow}>
                    <Text style={styles.kvLabel}>{t("balance") ?? "Balance"}</Text>
                    <Text style={styles.kvValue}>{balance.toLocaleString()} SYP</Text>
                  </View>

                  {/* <View style={{ gap: 8 }}> */}
                  {remaining > 0 && <View style={styles.kvRow}>
                    <View style={[styles.kvRow, { justifyContent: 'flex-start', gap: 0 }]}>
                      <Text style={styles.kvLabel}>{t("remainingToNext") ?? "Remaining"}</Text>
                      <Text style={styles.kvValue}>{nextLabel}</Text>
                    </View>
                    <Text style={styles.kvValue}>
                      {remaining > 0 ? `${remaining.toLocaleString()} SYP` : (t("congrats") ?? "At top level")}
                    </Text>
                  </View>}
                  {remaining > 0 && <ProgressBar progress={progress} />}
                  {/* </View> */}

                  <View style={styles.kvRow}>
                    <Text style={styles.kvLabel}>{t("graceDays") ?? "Grace days"}</Text>
                    <Text style={styles.kvValue}>{graceDays}</Text>
                  </View>

                  {inGrace && (
                    <View style={[styles.graceBox, { borderColor: membershipTone.ring }]}>
                      <Text style={styles.graceTitle}>{t("gracePeriodActive") ?? "Grace period active"}</Text>
                      <Text style={styles.graceCopy}>
                        {(t("graceKeepLevel") ?? "Keep your balance above")} {currentThreshold.toLocaleString()} SYP
                      </Text>
                      <Text style={[styles.graceCopy, { color: palette.muted }]}>
                        {(t("graceUntil") ?? "Grace until")}: {graceUntil?.toLocaleDateString()}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </BottomSheetView>
          </BottomSheetModal>
        </View>
      </View>
    </BottomSheetModalProvider >
  );
}

const createStyles = (palette: any, isRTL: boolean, isDark: boolean, insets: any) => {
  const row = isRTL ? ("row-reverse" as const) : ("row" as const);
  const align = isRTL ? ("right" as const) : ("left" as const);

  // “soft card” shadows (keeps iOS + Android reasonable)
  const cardShadow = {
    shadowColor: "#000",
    shadowOpacity: isDark ? 0.18 : 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: isDark ? 2 : 1,
  };

  const hairline = isDark ? palette.border : "rgba(15, 23, 42, 0.08)";

  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: palette.background,
      paddingTop: insets.top,
      writingDirection: isRTL ? "rtl" : "ltr",
      direction: isRTL ? "rtl" : "ltr",
    },
    container: {
      flex: 1,
      // paddingHorizontal: 16,
      // paddingTop: 16,
      writingDirection: isRTL ? "rtl" : "ltr",
      direction: isRTL ? "rtl" : "ltr",
    },

    headerWrap: {
      // paddingTop: 10,
      // paddingHorizontal: 16,
      gap: 12,
    },

    topBar: {
      flexDirection: row,
      alignItems: "center",
      justifyContent: "space-between",
    },
    iconBtn: {
      width: 42,
      height: 42,
      borderRadius: 999,
      backgroundColor: palette.card,
      borderWidth: 1,
      borderColor: hairline,
      alignItems: "center",
      justifyContent: "center",
      ...cardShadow,
    },
    brandWrap: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    brandLogo: {
      height: 26,
      width: 90,
      resizeMode: "contain",
      opacity: isDark ? 0.95 : 1,
    },

    greetingWrap: {
      flexDirection: row,
      alignItems: "center",
      justifyContent: "space-between",
    },
    greetingCol: { flex: 1, gap: 6 },
    helloText: {
      color: palette.text,
      fontSize: 24,
      fontWeight: "900",
      textAlign: 'left',
      textTransform: 'capitalize'
    },
    addressRow: {
      flexDirection: 'row',
      alignItems: "center",
      gap: 5,
    },
    addressLabel: { color: palette.muted, fontSize: 13, },
    addressValue: { color: palette.muted, fontSize: 13, fontWeight: "700",textAlign:'left' },

    walletCard: {
      borderRadius: 20,
      padding: 14,
      borderWidth: 1,
      borderColor: hairline,
      overflow: "hidden",
      ...cardShadow,
    },
    walletGlowA: {
      position: "absolute",
      width: 220,
      height: 220,
      borderRadius: 999,
      opacity: isDark ? 0.08 : 0.14,
      top: -120,
      left: isRTL ? undefined : -110,
      right: isRTL ? -110 : undefined,
    },
    walletGlowB: {
      position: "absolute",
      width: 260,
      height: 260,
      borderRadius: 999,
      opacity: isDark ? 0.06 : 0.12,
      bottom: -160,
      left: isRTL ? -140 : undefined,
      right: isRTL ? undefined : -140,
    },
    walletRow: { flexDirection: 'row', gap: 12, alignItems: "flex-start" },
    walletTextCol: { flex: 1, gap: 8 },

    walletLabel: { color: palette.text, fontSize: 20, fontWeight: "700", textAlign:'left'  },
    walletValue: { color: palette.text, fontSize: 28, fontWeight: "900", textAlign:'left'  },

    walletBadgeRow: { flexDirection: row, justifyContent: isRTL ? "flex-end" : "flex-start" },
    levelPill: {
      flexDirection: row,
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      backgroundColor: palette.surface,
    },
    levelPillText: { fontWeight: "800", fontSize: 12 },

    walletMini: {
      paddingTop: 5
    },
    walletMiniLabel: { color: palette.muted, fontWeight: "800", fontSize: 12, textAlign: align },
    walletMiniValue: { color: palette.text, fontWeight: "900", fontSize: 13, marginTop: 4, textAlign: align },
    walletMiniHint: { color: palette.muted, fontWeight: "700", fontSize: 12, marginTop: 2, textAlign: align },
    graceBox: {
      marginTop: 10,
      padding: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: hairline,
      backgroundColor: isDark ? palette.surface : "#fffaf0",
      gap: 4,
    },
    graceTitle: { color: palette.accent, fontWeight: "800", fontSize: 13, textAlign: align },
    graceCopy: { color: palette.text, fontSize: 12, textAlign: align },

    searchRow: {
      flexDirection: 'row',
      gap: 10,
      alignItems: "center",
    },
    searchWrap: {
      flex: 1,
      position: "relative",
      backgroundColor: palette.card,
      borderWidth: 1,
      borderColor: hairline,
      borderRadius: 999,
      paddingHorizontal: 14,
      height: 48,
      justifyContent: "center",
      ...cardShadow,
    },
    searchIcon: {
      position: "absolute",
      top: 14,
      left: isRTL?undefined:14,
      right: isRTL?14:undefined,
      opacity: 0.9,
    },
    searchInput: {
      color: palette.text,
      paddingHorizontal: 34,
      fontSize: 14,
      fontWeight: "600",
      textAlign: align
    },
    searchRight: {
      position: "absolute",
      top: 14,
      right: isRTL?undefined:14,
      left: isRTL?14:undefined
    },

    filterBtn: {
      minWidth: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor: palette.card,
      borderWidth: 1,
      borderColor: hairline,
      flexDirection: 'row',
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      paddingHorizontal: 10,
      ...cardShadow,
    },
    filterDot: {
      minWidth: 18,
      height: 18,
      borderRadius: 999,
      backgroundColor: palette.accent,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 5,
    },
    filterDotText: { color: "#fff", fontWeight: "900", fontSize: 11 },

    sectionHead: {
      flexDirection: 'row',
      alignItems: "center",
      justifyContent: "space-between",
    },
    sectionTitle: { color: palette.text, fontSize: 16,textAlign:'left' },
    sectionAction: { color: palette.accent, fontWeight: "900",textAlign:'left' },

    catRow: { gap: 12 },
    catCard: {
      flex: 1,
      backgroundColor: palette.card,
      borderRadius: 18,
      padding: 10,
      borderWidth: 1,
      borderColor: hairline,
      alignItems: "center",
      gap: 8,
      ...cardShadow,
    },
    catImgBox: {
      width: "100%",
      height: 72,
      borderRadius: 16,
      overflow: "hidden",
      backgroundColor: palette.surface,
      alignItems: "center",
      justifyContent: "center",
      // borderWidth: 1,
    },
    catBg: {
      position: "absolute",
      width: "100%",
      height: "100%",
      resizeMode: "cover",
      opacity: 0.35,
      transform: [{ scale: 1.2 }],
    },
    catOverlay: {
      position: "absolute",
      width: "100%",
      height: "100%",
      backgroundColor: isDark ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.45)",
    },
    catIcon: {
      width: 86,
      height: 44,
      resizeMode: "contain",
    },
    catName: { color: palette.text, fontSize: 12, textAlign: "center" },

    productRow: {
      gap: 12,
      marginBottom: 12,
      // borderWidth:1,
      // paddingHorizontal: 16,
      justifyContent: 'space-between'
    },

    productCard: {
      backgroundColor: palette.card,
      borderRadius: 20,
      padding: 10,
      borderWidth: 1,
      borderColor: hairline,
      gap: 10,
      ...cardShadow,
    },
    productPressable: { gap: 0 },
    prodImgBox: {
      width: "100%",
      height: 110,
      borderRadius: 16,
      backgroundColor: palette.surface,
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
      // borderWidth: 1,
      // borderColor: hairline,
      marginBottom: 10
    },
    productImg: { height: '100%', aspectRatio: 4 / 3, resizeMode: "contain" },
    productName: { color: palette.text, fontWeight: "900", marginBottom: isRTL?0:4, textAlign:'left' },
    productDesc: { color: palette.muted, fontSize: 12, marginBottom:  isRTL?0:10, textAlign:'left'  },

    priceRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 5,
    },
    productOldPrice: {
      color: palette.muted,
      fontWeight: "700",
      fontSize: 12,
      textDecorationLine: "line-through",
    },
    productPrice: { color: palette.accent, fontWeight: "900", fontSize: 16 },

    addBtn: {
      backgroundColor: palette.accent,
      borderRadius: 14,
      paddingVertical: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    addBtnText: { color: "#fff", fontWeight: "900" },

    qtyRow: {
      flexDirection: row,
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    qtyBtn: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: hairline,
      alignItems: "center",
      justifyContent: "center",
    },
    qtySym: { color: palette.text, fontSize: 18, fontWeight: "900" },
    qtyVal: { color: palette.text, fontSize: 16, fontWeight: "900", minWidth: 24, textAlign: "center" },

    emptyText: { color: palette.muted, paddingHorizontal: 16, textAlign: align, marginTop: 10 },

    promoBackdrop: {
      flex: 1,
      backgroundColor: "rgba(15, 23, 42, 0.55)",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
    },
    promoSheet: {
      backgroundColor: palette.card,
      borderRadius: 20,
      padding: 14,
      gap: 12,
      borderWidth: 1,
      borderColor: hairline,
      ...cardShadow,
    },
    promoHeader: { flexDirection: row, alignItems: "center", justifyContent: "space-between" },
    promoTitle: { color: palette.text, fontWeight: "900", fontSize: 16, textAlign: align },
    promoClose: {
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 999,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: hairline,
    },
    promoCloseText: { color: palette.text, fontWeight: "800", fontSize: 12 },
    promoSlide: { gap: 10 },
    promoImageWrap: {
      height: 140,
      borderRadius: 16,
      backgroundColor: palette.surface,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      borderWidth: 1,
      borderColor: hairline,
    },
    promoImage: { width: "100%", height: "100%", resizeMode: "cover" },
    promoFallback: { width: 120, height: 40, resizeMode: "contain", opacity: isDark ? 0.9 : 0.8 },
    promoContent: { gap: 6 },
    promoHeadline: { color: palette.text, fontWeight: "900", fontSize: 18, textAlign: align },
    promoCopy: { color: palette.muted, fontWeight: "600", textAlign: align },
    promoLinkBtn: {
      backgroundColor: palette.accent,
      borderRadius: 14,
      paddingVertical: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    promoLinkText: { color: "#fff", fontWeight: "900" },
    promoDots: { flexDirection: row, justifyContent: "center", gap: 6 },
    promoDot: { width: 6, height: 6, borderRadius: 999, backgroundColor: hairline },
    promoDotActive: { width: 16, backgroundColor: palette.accent },

    // Sheets
    sheetContainer: { paddingHorizontal: 16, paddingBottom: 100, flex: 1 },
    sheetContent: { flex: 1, gap: 6 },
    sheetTitle: { paddingTop: 10, color: palette.text, fontSize: 18, fontWeight: "900", marginBottom: 10, textAlign: 'left' },
    sheetLabel: { color: palette.muted, fontWeight: "900", marginTop: 8, marginBottom: 6, textAlign:'left' },
    sheetPills: { flexDirection: 'row', flexWrap: "wrap", gap: 10 },

    pill: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: hairline,
      backgroundColor: palette.surface,
    },
    pillActive: {
      borderColor: palette.accent,
      backgroundColor: isDark ? palette.surface : "rgba(249,115,22,0.14)",
    },
    pillText: { color: palette.text, fontWeight: "800" },
    pillTextActive: { color: palette.text, fontWeight: "900" },

    sheetText: { color: palette.muted, fontWeight: "700",textAlign:'left' },

    sheetFooterWrap: {
      flexDirection: row,
      gap: 10,
      paddingHorizontal: 16,
      paddingBottom: 18,
      paddingTop: 10,
      backgroundColor: "transparent",
    },
    sheetBtn: {
      flex: 1,
      backgroundColor: palette.accent,
      borderRadius: 16,
      paddingVertical: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    sheetBtnText: { color: "#fff", fontWeight: "900" },

    sheetBtnGhost: {
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: hairline,
    },
    sheetBtnTextGhost: { color: palette.text },

    addressItem: {
      padding: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: hairline,
      backgroundColor: palette.surface,
      marginBottom: 10,
      gap: 6,
    },
    addressItemActive: {
      borderColor: palette.accent,
      backgroundColor: isDark ? palette.surface : "rgba(249,115,22,0.10)",
    },
    addressTitle: { color: palette.text, fontWeight: "900" },

    closeBtn: {
      marginTop: 4,
      borderRadius: 16,
      paddingVertical: 12,
      alignItems: "center",
      borderWidth: 1,
      borderColor: hairline,
      backgroundColor: palette.card,
    },
    closeBtnText: { color: palette.accent, fontWeight: "900" },

    kvRow: {
      flexDirection: 'row',
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    kvLabel: { color: palette.muted, textAlign:'left' },
    kvValue: { color: palette.text, fontWeight: "900", textAlign:'left' },
  });
};
