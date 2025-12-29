import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Image, Text, View, StyleSheet, TouchableOpacity } from "react-native";
import Button from "../../components/Button";
import Screen from "../../components/Screen";
import api from "../../lib/api";
import { useCart } from "../../lib/cart";
import { useTheme } from "../../lib/theme";
import { useI18n } from "../../lib/i18n";

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [product, setProduct] = useState<any>();
  const { addItem, items, setQuantity } = useCart();
  const { palette, isDark } = useTheme();
  const { t, isRTL } = useI18n();
  const styles = useMemo(() => createStyles(palette, isRTL), [palette, isRTL]);

  const fallbackLogo = isDark ? require("../../assets/shopico_logo.png") : require("../../assets/shopico_logo-black.png");

  useEffect(() => {
    api.get(`/products/${id}`).then((res) => setProduct(res.data.data));
  }, [id]);

  const existing = items.find((i) => i.productId === product?._id);

  if (!product) return null;

  return (
    <Screen showBack backLabel={t("back") ?? "Back"}>
      <View style={styles.prodImgBox}>
        <Image
          source={product.images?.[0]?.url ? {
            uri: product.images?.[0]?.url
          } :
            fallbackLogo
          }
          style={[styles.img, !product.images?.[0]?.url && styles.defaultImage]}
        />
      </View>
      <Text style={styles.name}>{product.name}</Text>
      <Text style={styles.price}>{product.price?.toLocaleString()} SYP</Text>
      <Text style={styles.desc}>{product.description}</Text>
      {existing ? (
        <View style={styles.qtyRow}>
          <TouchableOpacity
            style={styles.qtyButton}
            onPress={() => setQuantity(existing.productId, existing.quantity - 1)}
          >
            <Text style={styles.qtySymbol}>-</Text>
          </TouchableOpacity>
          <Text style={styles.qtyValue}>{existing.quantity}</Text>
          <TouchableOpacity
            style={styles.qtyButton}
            onPress={() => {
              addItem({ productId: product._id, name: product.name, price: product.price, image: product.images?.[0]?.url, quantity: 1 });
            }}
          >
            <Text style={styles.qtySymbol}>+</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Button
          title={t("addToCart")}
          onPress={() => {
            addItem({ productId: product._id, name: product.name, price: product.price, image: product.images?.[0]?.url, quantity: 1 });
          }}
        />
      )}
    </Screen>
  );
}

const createStyles = (palette: any, isRTL: boolean) =>
  StyleSheet.create({
    prodImgBox: {
      width: "100%",
      height: 240,
      borderRadius: 16,
      backgroundColor: palette.surface,
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
      // borderWidth: 1,
      // borderColor: hairline,
      marginBottom: 10
    },
    img: { height: '100%', aspectRatio: 4 / 3, resizeMode: "contain" },
    defaultImage: {
      tintColor: '#dedede'
    },
    name: { color: palette.text, fontSize: 24, fontWeight: "800", textAlign: isRTL ? "right" : "left" },
    price: { color: palette.accent, fontSize: 18, marginVertical: 4, textAlign: isRTL ? "right" : "left" },
    desc: { color: palette.muted, marginBottom: 12, textAlign: isRTL ? "right" : "left" },
    qtyRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginTop: 8,
      justifyContent: 'space-between'
    },
    qtyButton: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.border,
    },
    qtySymbol: { color: palette.text, fontSize: 20, fontWeight: "800" },
    qtyValue: { color: palette.text, fontSize: 18, fontWeight: "800", minWidth: 24, textAlign: "center" },
  });
