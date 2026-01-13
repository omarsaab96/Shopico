import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  TouchableOpacity,
  View,
  StyleSheet,
  Image,
  TextInput,
  ActivityIndicator,
  Keyboard,
} from "react-native";
import Screen from "../../components/Screen";
import Text from "../../components/Text";
import api from "../../lib/api";
import { useTheme } from "../../lib/theme";
import { useI18n } from "../../lib/i18n";
import { useCart } from "../../lib/cart";
import Feather from "@expo/vector-icons/Feather";
import AntDesign from "@expo/vector-icons/AntDesign";
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';

export default function CategoryDetail() {
  const router = useRouter();
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();

  const [products, setProducts] = useState<any[]>([]);
  const [categoryName, setCategoryName] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [searching, setSearching] = useState(false);

  const { items, addItem, setQuantity } = useCart();
  const { palette, isDark } = useTheme();
  const { t, isRTL } = useI18n();

  const styles = useMemo(
    () => createStyles(palette, isRTL, isDark),
    [palette, isRTL, isDark]
  );

  const fallbackLogo = isDark
    ? require("../../assets/shopico_logo.png")
    : require("../../assets/shopico_logo-black.png");

  useEffect(() => {
    api.get(`/products?category=${id}`).then((res) => {
      setProducts(res.data.data || []);
    });
    if (name) setCategoryName(name);
  }, [id, name]);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(handle);
  }, [search]);

  useEffect(() => {
    if (!debouncedSearch) {
      api.get(`/products?category=${id}`).then((res) => {
        setProducts(res.data.data || []);
      });
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
      <Text weight="black" style={styles.title}>{categoryName || t("products")}</Text>

      {/* SEARCH */}
      <View style={styles.searchWrap}>
        <Feather
          name="search"
          size={18}
          color={palette.muted}
          style={styles.searchIcon}
        />

        <TextInput
          style={styles.searchInput}
          placeholder={t("searchProducts")}
          placeholderTextColor={palette.muted}
          value={search}
          onChangeText={setSearch}
        />

        {searching ? (
          <ActivityIndicator
            size="small"
            color={palette.accent}
            style={styles.searchRight}
          />
        ) : (
          search.trim() && (
            <TouchableOpacity
              style={styles.searchRight}
              onPress={() => {
                setSearch("");
                Keyboard.dismiss();
              }}
            >
              <AntDesign name="close" size={18} color={palette.text} />
            </TouchableOpacity>
          )
        )}
      </View>

      {/* PRODUCTS */}
      <FlatList
        data={products}
        keyExtractor={(p) => p._id}
        contentContainerStyle={{ paddingBottom: 16 }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        renderItem={({ item, index }) => {
          const existing = items.find((i) => i.productId === item._id);
          const isLeft = index % 2 === 0;



          return (
            // <View
            //   style={{
            //     borderWidth:1,
            //     width: "50%",
            //     paddingRight: isLeft && !isRTL ? 6 : isLeft && isRTL ? 0 : 6,
            //     paddingLeft: isLeft && !isRTL ? 0 : isLeft && isRTL ? 6 : 0,
            //   }}
            // >
              <View style={styles.card}>
                <TouchableOpacity
                  style={styles.cardPress}
                  onPress={() => router.push(`/products/${item._id}`)}
                  activeOpacity={0.9}
                >
                  <View style={styles.imageBox}>
                    <Image
                      source={
                        item.images?.[0]?.url
                          ? { uri: item.images[0].url }
                          : fallbackLogo
                      }
                      style={[styles.image,{tintColor: '#dedede'}]}
                    />
                  </View>

                  <View style={styles.infoCol}>
                    <Text weight="black" style={styles.name} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.description} numberOfLines={2}>
                      {item.description}
                    </Text>
                    <View style={styles.priceRow}>
                      {item.isPromoted && item.promoPrice !== undefined ? (
                        <Text style={styles.oldPrice}>
                          {item.price.toLocaleString()} SYP
                        </Text>
                      ) : null}
                      <Text weight="bold" style={styles.price}>
                        {(item.isPromoted && item.promoPrice !== undefined ? item.promoPrice : item.price).toLocaleString()} SYP
                      </Text>
                      {item.isPromoted && item.promoPrice !== undefined && item.price > 0 ? (
                        <Text style={styles.promoBadge}>
                          {Math.round((1 - item.promoPrice / item.price) * 100)}% {t("off") ?? "off"}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <View>
                    {existing ? (
                      <View style={styles.qtyRow}>
                        <TouchableOpacity
                          style={styles.qtyBtn}
                          onPress={() =>
                            setQuantity(existing.productId, existing.quantity - 1)
                          }
                        >
                          <Text weight="black" style={styles.qtyText}>−</Text>
                        </TouchableOpacity>

                        <Text weight="black" style={styles.qtyValue}>{existing.quantity}</Text>

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
                          <Text weight="black" style={styles.qtyText}>+</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
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
                        <FontAwesome6 name="cart-plus" size={20} color={'#fff'} />
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
              </View>
            // </View>
          );
        }}
      />
    </Screen>
  );
}

const createStyles = (palette: any, isRTL: boolean, isDark: boolean) => {
  const row = isRTL ? "row-reverse" : "row";
  const align = isRTL ? "right" : "left";

  const shadow = {
    shadowColor: "#000",
    shadowOpacity: isDark ? 0.2 : 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: isDark ? 2 : 1,
  };

  return StyleSheet.create({
    title: {
      fontSize: 26,
      color: palette.text,
      marginBottom: 12,
    },

    /* SEARCH */
    searchWrap: {
      position: "relative",
      height: 48,
      borderRadius: 999,
      backgroundColor: palette.card,
      borderWidth: 1,
      borderColor: palette.border,
      justifyContent: "center",
      marginBottom: 12,
      ...shadow,
    },
    searchIcon: {
      position: "absolute",
      left: isRTL ? 0 : 14,
      right: isRTL ? 14 : 0,
      top: 15,
    },
    searchInput: {
      paddingHorizontal: 34,
      color: palette.text,
      textAlign: align
    },
    searchRight: {
      position: "absolute",
      right:14,
      top: 14,
    },

    /* CARD */
    card: {
      backgroundColor: palette.card,
      borderRadius: 20,
      padding: 12,
      borderWidth: 1,
      borderColor: palette.border,
      ...shadow,
      gap: 10,
    },

    cardPress: {
      flexDirection: 'row',
      gap: 12,
      alignItems: "center",
    },

    imageBox: {
      width: 96,
      height: 96,
      borderRadius: 18,
      backgroundColor: palette.surface,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: palette.border,
      overflow: "hidden",
    },

    image: {
      width: "85%",
      height: "85%",
      resizeMode: "contain",
    },

    infoCol: {
      flex: 1,
      gap: 4,
    },

    name: {
      fontSize: 15,
      color: palette.text,
    },

    description: {
      fontSize: 12,
      color: palette.mutted,
    },

    priceRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    oldPrice: {
      fontSize: 12,
      color: palette.muted,
      textDecorationLine: "line-through",
    },
    promoBadge: {
      backgroundColor: palette.accent,
      color: "#0f172a",
      fontSize: 11,
      fontWeight: "800",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 8,
    },
    price: {
      fontSize: 16,
      color: palette.accent,
      marginBottom: 10
    },

    /* ACTIONS */
    addBtn: {
      backgroundColor: palette.accent,
      borderRadius: 14,
      alignItems: "center",
      width: 40,
      height: 40,
      justifyContent: 'center'
    },
    addBtnText: {
      color: "#fff",
    },

    qtyRow: {
      flexDirection: row,
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },

    qtyBtn: {
      width: 40,
      height: 40,
      borderRadius: 14,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.border,
      alignItems: "center",
      justifyContent: "center",
    },

    qtyText: {
      fontSize: 18,
      color: palette.text,
    },

    qtyValue: {
      fontSize: 16,
      color: palette.text,
      minWidth: 24,
      textAlign: "center",
    },
  });
};
