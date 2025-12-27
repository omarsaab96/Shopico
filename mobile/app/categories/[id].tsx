import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { FlatList, Text, TouchableOpacity, View, StyleSheet, Image, TextInput, ActivityIndicator, Keyboard } from "react-native";
import Screen from "../../components/Screen";
import api from "../../lib/api";
import { useTheme } from "../../lib/theme";
import { useI18n } from "../../lib/i18n";
import { useCart } from "../../lib/cart";
import Feather from "@expo/vector-icons/Feather";
import AntDesign from "@expo/vector-icons/AntDesign";

export default function CategoryDetail() {
  const router = useRouter();
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const [products, setProducts] = useState<any[]>([]);
  const [categoryName, setCategoryName] = useState<string>("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const { items, addItem, setQuantity } = useCart();
  const { palette, isDark } = useTheme();
  const { t, isRTL } = useI18n();
  const styles = useMemo(() => createStyles(palette, isRTL), [palette, isRTL]);
  const fallbackLogo = isDark ? require("../../assets/shopico_logo.png") : require("../../assets/shopico_logo-black.png");

  useEffect(() => {
    api.get(`/products?category=${id}`).then((res) => setProducts(res.data.data || []));
    if (name) setCategoryName(name);
  }, [id, name]);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(handle);
  }, [search]);

  useEffect(() => {
    if (!debouncedSearch) {
      api.get(`/products?category=${id}`).then((res) => setProducts(res.data.data || []));
      return;
    }
    setSearching(true);
    api
      .get(`/products?q=${encodeURIComponent(debouncedSearch)}&category=${id}`)
      .then((res) => setProducts(res.data.data || []))
      .catch(() => setProducts([]))
      .finally(() => setSearching(false));
  }, [debouncedSearch, id]);

  return (
    <Screen showBack backLabel={t("back") ?? "Back"}>
      <Text style={styles.title}>{categoryName || t("products")}</Text>
      <View style={styles.searchWrapper}>
        <TextInput
          style={styles.search}
          placeholder={t("searchProducts")}
          placeholderTextColor={palette.muted}
          value={search}
          onChangeText={setSearch}
        />
        <Feather name="search" size={22} color={palette.text} style={styles.searchIcon} />
        {searching ? (
          <ActivityIndicator size="small" color={palette.accent} style={styles.searchSpinner} />
        ) : (
          search.trim() && (
            <AntDesign
              name="close"
              size={18}
              color={palette.text}
              style={styles.searchSpinner}
              onPress={() => {
                setSearch("");
                Keyboard.dismiss();
              }}
            />
          )
        )}
      </View>
      <FlatList
        data={products}
        keyExtractor={(p) => p._id}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <TouchableOpacity
              onPress={() => {
                router.push(`/products/${item._id}`)
              }}
              style={{ flexDirection: "row", flex: 1, gap: 10, alignItems: "center" }}
            >
              <View style={styles.prodImgContainer}>
                <Image
                  source={
                    item.images?.[0]?.url
                      ? { uri: item.images?.[0]?.url }
                      : fallbackLogo
                  }
                  style={styles.productImg} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.price}>{item.price.toLocaleString()} SYP</Text>
              </View>
            </TouchableOpacity>

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
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={() => addItem({ productId: item._id, name: item.name, price: item.price, image: item.images?.[0]?.url, quantity: 1 })}
                >
                  <Text style={styles.addButtonText}>{t("addToCart")}</Text>
                </TouchableOpacity>
              );
            })()}
          </View>
        )}
      />
    </Screen>
  );
}

const createStyles = (palette: any, isRTL: boolean) =>
  StyleSheet.create({
    title: { color: palette.text, fontSize: 22, fontWeight: "800", marginBottom: 12, textAlign: isRTL ? "right" : "left" },
    searchWrapper: { position: "relative", marginBottom: 10 },
    search: {
      backgroundColor: palette.card,
      borderRadius: 12,
      padding: 12,
      paddingLeft: 36,
      paddingRight: 36,
      color: palette.text,
      borderWidth: 1,
      borderColor: palette.border,
    },
    searchSpinner: { position: "absolute", right: 12, top: 10 },
    searchIcon: { position: "absolute", left: 10, top: 10 },
    row: {
      backgroundColor: palette.card,
      borderRadius: 12,
      padding: 8,
      borderWidth: 1,
      borderColor: palette.border,
      flexDirection: "row",
      gap: 10,
      alignItems: "center",
    },
    img: { width: 64, height: 64, borderRadius: 12, backgroundColor: palette.surface },
    prodImgContainer: {
      backgroundColor: palette.surface,
      borderRadius: 12,
      overflow: 'hidden',
      width: 96,
      height: 96,
      alignItems: 'center',
      justifyContent: 'center'
    },
    productImg: { height: 86, aspectRatio: 1, objectFit: 'contain' },
    name: { color: palette.text, fontWeight: "700" },
    price: { color: palette.accent },
    addButton: {
      backgroundColor: palette.accent,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 10,
    },
    addButtonText: { color: "#fff", fontWeight: "700" },
    qtyRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    qtyButton: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: palette.surface,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: palette.border,
    },
    qtySymbol: { color: palette.text, fontSize: 18, fontWeight: "800" },
    qtyValue: { color: palette.text, fontSize: 16, fontWeight: "800", minWidth: 24, textAlign: "center" },
  });
