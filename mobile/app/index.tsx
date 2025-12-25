import { Link } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { FlatList, Text, TextInput, View, StyleSheet, Image, TouchableOpacity, ActivityIndicator, Keyboard } from "react-native";
import Screen from "../components/Screen";
import api from "../lib/api";
import { useTheme } from "../lib/theme";
import { useI18n } from "../lib/i18n";
import Feather from '@expo/vector-icons/Feather';
import AntDesign from '@expo/vector-icons/AntDesign';

type Category = { _id: string; name: string; imageUrl?: string };
type Product = { _id: string; name: string; price: number; images: { url: string }[] };

const FALLBACK_CATEGORY_IMAGE = "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=640&q=80&auto=format&fit=crop";
const FALLBACK_PRODUCT_IMAGE = "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=640&q=80&auto=format&fit=crop";

export default function Home() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Product[] | null>(null);
  const [searching, setSearching] = useState(false);
  const { palette } = useTheme();
  const { t, isRTL } = useI18n();
  const styles = useMemo(() => createStyles(palette, isRTL), [palette, isRTL]);

  useEffect(() => {
    api.get("/categories").then((res) => setCategories(res.data.data || []));
    api.get("/products").then((res) => setProducts(res.data.data || []));
  }, []);

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
    console.log(url)
    api.get(url)
      .then((res) => setSearchResults(res.data.data || []))
      .catch(() => setSearchResults([]))
      .finally(() => setSearching(false));
  }, [debouncedSearch]);

  const hasQuery = debouncedSearch.length > 0;
  const visibleProducts = hasQuery ? searchResults ?? products : products;

  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.title}>{t("helloShopper")}</Text>
        <Text style={styles.subtitle}>{t("shopTagline")}</Text>
      </View>
      <View style={styles.searchWrapper}>
        <TextInput
          style={styles.search}
          placeholder={t("searchProducts")}
          placeholderTextColor={palette.muted}
          value={search}
          onChangeText={setSearch}
        />

        <Feather name="search" size={24} color="black" style={styles.searchIcon} />
        {searching ? (
          <ActivityIndicator size="small" color={palette.accent} style={styles.searchSpinner} />
        ) : (
          search.trim() &&
          <AntDesign name="close" size={20} color="black" style={styles.searchSpinner} onPress={() => { setSearch(''); Keyboard.dismiss() }} />
        )}
      </View>
      {!hasQuery && (
        <>
          <Text style={styles.section}>{t("featuredCategories")}</Text>
          <FlatList
            data={categories}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            style={{
              flexGrow: 0,
            }}
            keyExtractor={(c) => c._id}
            contentContainerStyle={{ gap: 10 }}
            renderItem={({ item }) => (
              <Link href={`/categories/${item._id}`} asChild>
                <TouchableOpacity style={styles.categoryCard}>
                  <View style={styles.catImgContainer}>
                    <Image
                      source={
                        item.imageUrl
                          ? { uri: item.imageUrl }
                          : require("../assets/shopico_logo-black.png")
                      }
                      style={[styles.categoryImg, !item.imageUrl && styles.defaultImage]} />
                  </View>

                  <Text style={styles.chipText}>{item.name}</Text>
                </TouchableOpacity>
              </Link>
            )}
          />
        </>
      )}
      <Text style={styles.section}>
        {hasQuery
          ? `${t("products")} (${visibleProducts.length})`
          : t("freshPicks")}
      </Text>
      <FlatList
        data={visibleProducts}
        numColumns={2}
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        keyExtractor={(p) => p._id}
        style={{
          flexGrow: 0,
        }}
        contentContainerStyle={{ gap: 14 }}
        renderItem={({ item }) => (
          <Link href={`/products/${item._id}`} asChild>
            <TouchableOpacity style={styles.product}>
              <View style={styles.prodImgContainer}>
                <Image
                  source={
                    item.images?.[0]?.url
                      ? { uri: item.images?.[0]?.url }
                      : require("../assets/shopico_logo-black.png")
                  }
                  style={[styles.productImg, !item.images?.[0]?.url && styles.defaultImage]} />
              </View>
              <View style={styles.productContent}>
                <Text style={styles.productName}>{item.name}</Text>
                <Text style={styles.productPrice}>{item.price.toLocaleString()} SYP</Text>
              </View>
            </TouchableOpacity>
          </Link>
        )}
      />
      {hasQuery ? (
        <Text style={styles.searchMeta}>
          {/* {searching ? t("searching") : `${visibleProducts.length} ${t("products")}`} */}
          {visibleProducts.length == 0 && t("emptyProducts")}
        </Text>
      ) : null}
    </Screen>
  );
}

const createStyles = (palette: any, isRTL: boolean) =>
  StyleSheet.create({
    hero: { gap: 6, marginBottom: 8 },
    title: {
      color: palette.text,
      fontSize: 26,
      fontWeight: "800",
      textAlign: isRTL ? "right" : "left",
    },
    subtitle: { color: palette.muted, fontSize: 14, textAlign: isRTL ? "right" : "left" },
    search: {
      backgroundColor: palette.surface,
      borderRadius: 14,
      padding: 14,
      paddingLeft: 40,
      color: palette.text,
      // borderWidth: 1,
      // borderColor: palette.border,
      marginBottom: 12,
      paddingRight: 40,
    },
    section: { color: palette.text, fontWeight: "700", marginVertical: 12, textAlign: isRTL ? "right" : "left" },
    searchMeta: { color: palette.muted, marginTop: 8, textAlign: isRTL ? "right" : "left" },
    searchWrapper: { position: "relative" },
    searchSpinner: { position: "absolute", right: 12, top: 12 },
    searchIcon: { position: "absolute", left: 10, top: 12 },

    categoryCard: {
      backgroundColor: palette.card,
      padding: 10,
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
      overflow: 'hidden',
      padding: 5,
      width: 96,
      height: 96,
    },
    categoryImg: { width: 86, height: 86, objectFit: 'contain', aspectRatio: 1 },
    defaultImage: {},
    chipText: { color: palette.text, textAlign: "center" },
    product: {
      width: 180,
      backgroundColor: palette.card,
      borderRadius: 14,
      padding: 10,
      borderWidth: 1,
      borderColor: palette.border,
      shadowColor: palette.border,
      shadowOpacity: 0.12,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      gap: 8
    },
    prodImgContainer: {
      backgroundColor: palette.surface,
      borderRadius: 12,
      overflow: 'hidden',
      width: '100%',
      height: 96,
      alignItems:'center',
      justifyContent:'center'
    },
    productImg: { height: 86, aspectRatio: 4 / 3, objectFit:'contain' },
    productContent: { gap: 4 },
    productName: { color: palette.text, fontWeight: "700" },
    productPrice: { color: palette.accent, marginTop: 2 },
  });
