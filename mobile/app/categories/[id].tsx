import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  LayoutChangeEvent,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AntDesign from "@expo/vector-icons/AntDesign";
import Feather from "@expo/vector-icons/Feather";
import FontAwesome from "@expo/vector-icons/FontAwesome";

import Screen from "../../components/Screen";
import Text from "../../components/Text";
import api from "../../lib/api";
import { useCart } from "../../lib/cart";
import { useCurrency } from "../../lib/currency";
import { useI18n } from "../../lib/i18n";
import { useTheme } from "../../lib/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { translate } from "@shopify/react-native-skia";

type Category = {
  _id: string;
  name: string;
  description?: string;
  imageUrl?: string;
};

type Product = {
  _id: string;
  name: string;
  description?: string;
  price: number;
  promoPrice?: number;
  isPromoted?: boolean;
  images?: { url: string }[];
  variants?: { _id: string }[];
};

export default function CategoryDetail() {
  const router = useRouter();
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const insets = useSafeAreaInsets();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState(id);
  const [categoryName, setCategoryName] = useState("");
  const [productsLoading, setProductsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [searching, setSearching] = useState(false);

  const { items, addItem, setQuantity } = useCart();
  const { palette, isDark } = useTheme();
  const { t, isRTL } = useI18n();
  const { selectedCurrency, formatMoney } = useCurrency();
  const categoryScrollRef = useRef<ScrollView>(null);
  const categoryPillLayouts = useRef<Record<string, { x: number; width: number }>>({});
  const [categoryBandWidth, setCategoryBandWidth] = useState(0);
  const cartItemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const cartSubtotal = items.reduce((sum, item) => (item.unavailable ? sum : sum + item.price * item.quantity), 0);

  const scrollCategoryPillIntoView = useCallback((categoryId: string, animated = true) => {
    const frame = requestAnimationFrame(() => {
      const layout = categoryPillLayouts.current[categoryId];
      if (!layout || categoryBandWidth === 0) return;
      categoryScrollRef.current?.scrollTo({
        x: Math.max(0, layout.x + layout.width / 2 - categoryBandWidth / 2),
        animated,
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [categoryBandWidth]);

  const styles = useMemo(() => createStyles(palette, isRTL, isDark, insets), [palette, isRTL, isDark, insets]);
  const fallbackLogo = isDark
    ? require("../../assets/shopico_logo.png")
    : require("../../assets/shopico_logo-black.png");

  useEffect(() => {
    setActiveCategoryId(id);
  }, [id]);

  useEffect(() => {
    api
      .get("/categories")
      .then((res) => setCategories(res.data.data || []))
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    const activeCategory = categories.find((category) => category._id === activeCategoryId);
    setCategoryName(activeCategory?.name || name || "");
  }, [activeCategoryId, categories, name]);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(handle);
  }, [search]);

  useEffect(() => {
    const query = debouncedSearch
      ? `/products?q=${encodeURIComponent(debouncedSearch)}&category=${activeCategoryId}`
      : `/products?category=${activeCategoryId}`;

    setProductsLoading(true);
    setSearching(Boolean(debouncedSearch));
    setProducts([]);
    api
      .get(query)
      .then((res) => setProducts(res.data.data || []))
      .catch(() => setProducts([]))
      .finally(() => {
        setSearching(false);
        setProductsLoading(false);
      });
  }, [activeCategoryId, debouncedSearch]);

  useEffect(() => {
    return scrollCategoryPillIntoView(activeCategoryId);
  }, [activeCategoryId, categories.length, scrollCategoryPillIntoView]);

  const renderCategoryBand = () => {
    if (categories.length === 0) return null;

    return (
      <View style={{}}>
        <View style={styles.searchWrap}>
          <Feather name="search" size={18} color={palette.muted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={t("searchProducts")}
            placeholderTextColor={palette.muted}
            value={search}
            onChangeText={setSearch}
          />

          {searching ? (
            <ActivityIndicator size="small" color={palette.accent} style={styles.searchRight} />
          ) : search.trim() ? (
            <TouchableOpacity
              style={styles.searchRight}
              onPress={() => {
                setSearch("");
                Keyboard.dismiss();
              }}
            >
              <AntDesign name="close" size={18} color={palette.text} />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.categoryBand}>
          <ScrollView
            ref={categoryScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryPillRow}
            onLayout={(event) => setCategoryBandWidth(event.nativeEvent.layout.width)}
          >
            {categories.map((category) => {
              const active = category._id === activeCategoryId;
              return (
                <TouchableOpacity
                  key={category._id}
                  style={[styles.categoryPill, active && styles.categoryPillActive]}
                  activeOpacity={0.85}
                  onLayout={(event: LayoutChangeEvent) => {
                    categoryPillLayouts.current[category._id] = event.nativeEvent.layout;
                    if (category._id === activeCategoryId) {
                      scrollCategoryPillIntoView(category._id, false);
                    }
                  }}
                  onPress={() => {
                    if (!active) {
                      setActiveCategoryId(category._id);
                      setSearch("");
                    }
                  }}
                >
                  <Text
                    weight={active ? "black" : "bold"}
                    style={[styles.categoryPillText, active && styles.categoryPillTextActive]}
                    numberOfLines={1}
                  >
                    {category.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    );
  };

  const renderProduct = ({ item }: { item: Product; index: number }) => {
    const hasVariants = Boolean(item.variants?.length);
    const existing = items.find((cartItem) => cartItem.productId === item._id && !cartItem.variantId);
    const effectivePrice = item.isPromoted && item.promoPrice !== undefined ? item.promoPrice : item.price;

    const addProduct = () => {
      if (hasVariants) {
        router.push(`/products/${item._id}`);
        return;
      }

      addItem({
        productId: item._id,
        name: item.name,
        price: effectivePrice,
        originalPrice: item.isPromoted && item.promoPrice !== undefined ? item.price : undefined,
        isPromoted: item.isPromoted && item.promoPrice !== undefined,
        image: item.images?.[0]?.url,
        quantity: 1,
      });
    };

    return (
      <View style={styles.productGridItem}>
        <View style={styles.productCard}>
          <TouchableOpacity
            style={styles.productPressable}
            activeOpacity={0.8}
            onPress={() => router.push(`/products/${item._id}`)}
          >
            <View
              style={[
                styles.prodImgBox,
                !item.images?.[0]?.url && { backgroundColor: isDark ? "#333" : "#f0f0f0" },
              ]}
            >
              <Image
                source={item.images?.[0]?.url ? { uri: item.images[0].url } : fallbackLogo}
                style={[
                  styles.productImg,
                  !item.images?.[0]?.url && { tintColor: isDark ? "#444" : "#dedede" },
                ]}
              />

              {existing ? (
                <View style={styles.qtyRow}>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() => setQuantity(existing.productId, existing.quantity - 1, existing.variantId)}
                  >
                    {existing.quantity > 1 ? (
                      <AntDesign name="minus" size={20} color={palette.text} />
                    ) : (
                      <FontAwesome name="trash-o" size={20} color={palette.text} />
                    )}
                  </TouchableOpacity>

                  <Text style={styles.qtyVal}>{existing.quantity}</Text>

                  <TouchableOpacity style={styles.qtyBtn} onPress={addProduct}>
                    <AntDesign name="plus" size={20} color={palette.text} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.addBtn} onPress={addProduct}>
                  <AntDesign name="plus" size={20} color={palette.text} />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.priceRow}>
              <Text style={[styles.productPrice, item.isPromoted && { color: palette.accent }]}>
                {formatMoney(effectivePrice, selectedCurrency)}
              </Text>
              <Text style={styles.productOldPrice} numberOfLines={1}>
                {item.isPromoted && item.promoPrice !== undefined
                  ? formatMoney(item.price, selectedCurrency)
                  : ""}
              </Text>
            </View>

            {item.isPromoted && item.promoPrice !== undefined && item.price > 0 ? (
              <View style={styles.promoRow}>
                <Text style={styles.promoBadge}>
                  {Math.round((1 - item.promoPrice / item.price) * 100)}% {t("off") ?? "off"}
                </Text>
              </View>
            ) : null}

            <Text style={styles.productName} numberOfLines={2}>
              {item.name}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <Screen showBack backLabel={t("allCategories") ?? "All categories"}>
      {/* <Text weight="black" style={styles.title}>{categoryName || t("products")}</Text> */}

      {renderCategoryBand()}

      <View style={styles.contentWrap}>
        <FlatList
          data={products}
          key="category-products-grid"
          keyExtractor={(p) => p._id}
          numColumns={2}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.productListContent,
            cartItemCount > 0 && styles.productListContentWithCart,
          ]}
          columnWrapperStyle={styles.productRow}
          // ListHeaderComponent={renderCategoryBand()}
          renderItem={renderProduct}
          ListEmptyComponent={
            productsLoading ? (
              <View style={styles.productsLoader}>
                <ActivityIndicator size="large" color={palette.accent} />
              </View>
            ) : (
              <Text style={styles.emptyText}>{t("emptyProducts") ?? "No products found."}</Text>
            )
          }
        />

        {cartItemCount > 0 ? (
          <TouchableOpacity
            style={styles.cartCta}
            activeOpacity={0.9}
            onPress={() => router.push("/(tabs)/cart")}
          >
            <View style={{ width: 80 }}>
              <View style={styles.cartCtaCount}>
                <Text weight="black" style={styles.cartCtaCountText}>{cartItemCount}</Text>
              </View>
            </View>

            <Text weight="black" style={styles.cartCtaTitle} numberOfLines={1}>
              {t("viewYourCart") ?? "View your cart"}
            </Text>

            <Text weight="black" style={styles.cartCtaSubtotal} numberOfLines={1}>
              {formatMoney(cartSubtotal, selectedCurrency)}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </Screen>
  );
}

const createStyles = (palette: any, isRTL: boolean, isDark: boolean, insets: any) => {
  const row = isRTL ? ("row-reverse" as const) : ("row" as const);
  const align = isRTL ? ("right" as const) : ("left" as const);

  const cardShadow = {
    shadowColor: "#000",
    shadowOpacity: isDark ? 0.18 : 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: isDark ? 2 : 1,
  };

  const hairline = isDark ? palette.border : "rgba(15, 23, 42, 0.08)";

  return StyleSheet.create({
    title: {
      fontSize: 26,
      color: palette.text,
      marginBottom: 12,
      textAlign: align,
    },

    searchWrap: {
      position: "relative",
      height: 48,
      borderRadius: 999,
      backgroundColor: palette.card,
      borderWidth: 1,
      borderColor: palette.border,
      justifyContent: "center",
      marginBottom: 12,
      ...cardShadow,
    },
    searchIcon: {
      position: "absolute",
      left: 14,
      top: 14,
    },
    searchInput: {
      paddingHorizontal: 44,
      color: palette.text,
      textAlign: align,
      fontSize: 14,
      fontWeight: "600",
    },
    searchRight: {
      position: "absolute",
      right: 14,
      top: 14,
    },

    categoryBand: {
      marginBottom: 15,
      // paddingVertical: 10,
      // borderTopWidth: 1,
      // borderBottomWidth: 1,
      // borderColor: hairline,
    },
    categoryPillRow: {
      flexDirection: row,
      gap: 8,
      paddingRight: 2,
    },
    categoryPill: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: hairline,
      backgroundColor: palette.card,
    },
    categoryPillActive: {
      backgroundColor: isDark ? "transparent" : "#000",
      // backgroundColor: isDark ? "#2f2f2f" : "rgba(249,115,22,0.12)",
      borderColor: isDark ? "#2f2f2f" : "transparent",
    },
    categoryPillText: {
      color: palette.text,
      fontSize: 12,
      textAlign: "center",
    },
    categoryPillTextActive: {
      color: isDark ? palette.text: "#fff",
    },

    productListContent: {
      paddingBottom: 16,
    },
    productListContentWithCart: {
      paddingBottom: 96,
    },
    contentWrap: {
      flex: 1,
      position: "relative",
    },
    productRow: {
      gap: 12,
      marginBottom: 12,
      justifyContent: "space-between",
    },
    productGridItem: {
      width: "48%",
    },
    productCard: {},
    productPressable: {
      gap: 0,
    },
    prodImgBox: {
      borderRadius: 16,
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: hairline,
      marginBottom: 10,
      position: "relative",
    },
    productImg: {
      height: 150,
      aspectRatio: 1,
      resizeMode: "contain",
    },
    priceRow: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: 5,
    },
    productPrice: {
      color: isDark ? "#fff" : "#000",
      fontWeight: "900",
      fontSize: 18,
      lineHeight: 24,
    },
    productOldPrice: {
      color: palette.muted,
      fontWeight: "700",
      fontSize: 12,
      lineHeight: 12,
      textDecorationLine: "line-through",
    },
    promoRow: {
      flexDirection: row,
      justifyContent: "flex-start",
      position: "relative",
      marginTop: 4,
    },
    promoBadge: {
      backgroundColor: palette.accent,
      color: "#fff",
      fontSize: 12,
      fontWeight: "800",
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 15,
    },
    productName: {
      color: palette.text,
      fontWeight: isRTL ? "500" : "900",
      marginBottom: isRTL ? 0 : 4,
      textAlign: "left",
    },
    addBtn: {
      backgroundColor: isDark ? "#444" : "#fff",
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: hairline,
      position: "absolute",
      width: 30,
      height: 30,
      bottom: 10,
      right: 10,
      ...cardShadow,
    },
    qtyRow: {
      backgroundColor: isDark ? "#444" : "#fff",
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: row,
      borderWidth: 1,
      borderColor: hairline,
      position: "absolute",
      height: 30,
      bottom: 10,
      right: 10,
      gap: 10,
      paddingHorizontal: 10,
      ...cardShadow,
    },
    qtyBtn: {
      alignItems: "center",
      justifyContent: "center",
    },
    qtyVal: {
      color: palette.text,
      fontSize: 16,
      fontWeight: "900",
      minWidth: 24,
      textAlign: "center",
    },
    emptyText: {
      color: palette.muted,
      textAlign: align,
      marginTop: 16,
    },
    productsLoader: {
      paddingVertical: 40,
      alignItems: "center",
      justifyContent: "center",
    },
    cartCta: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: insets.bottom + 10,
      flexDirection: 'row',
      justifyContent: "space-between",
      gap: 12,
      paddingHorizontal: 10,
      // paddingVertical: isRTL? 0 : 8,
      paddingTop: isRTL ? 8 : 8,
      paddingBottom: isRTL ? 6 : 8,
      ...cardShadow,
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: "center",
      backgroundColor: palette.accent,
    },
    cartCtaCount: {
      width: 28,
      height: 28,
      borderRadius: 999,
      // backgroundColor: "rgba(255,255,255,0.18)",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: '#fff',
      opacity: 0.8
    },
    cartCtaCountText: {
      color: "#fff",
      fontSize: 14,
      lineHeight: 18,
      transform: [{ translateY: isRTL ? 2 : 0 }]
    },
    cartCtaTitle: {
      flex: 1,
      color: "#fff",
      fontSize: 14,
      textAlign: "center",
      lineHeight: 18
    },
    cartCtaSubtotal: {
      color: "#fff",
      fontSize: 14,
      textAlign: "right",
      width: 80,
      opacity: 0.8,
      lineHeight: 18
    },
  });
};
