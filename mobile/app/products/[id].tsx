import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Image, Text, View, StyleSheet } from "react-native";
import Button from "../../components/Button";
import Screen from "../../components/Screen";
import api from "../../lib/api";
import { useCart } from "../../lib/cart";
import { useAuth } from "../../lib/auth";
import { useTheme } from "../../lib/theme";
import { useI18n } from "../../lib/i18n";

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [product, setProduct] = useState<any>();
  const { addItem } = useCart();
  const { user } = useAuth();
  const router = useRouter();
  const { palette } = useTheme();
  const { t, isRTL } = useI18n();
  const styles = useMemo(() => createStyles(palette, isRTL), [palette, isRTL]);

  useEffect(() => {
    api.get(`/products/${id}`).then((res) => setProduct(res.data.data));
  }, [id]);

  if (!product) return null;

  return (
    <Screen>
      <Image source={{ uri: product.images?.[0]?.url || "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=640&q=80&auto=format&fit=crop" }} style={styles.img} />
      <Text style={styles.name}>{product.name}</Text>
      <Text style={styles.price}>{product.price?.toLocaleString()} SYP</Text>
      <Text style={styles.desc}>{product.description}</Text>
      <Button
        title={t("addToCart")}
        onPress={() => {
          if (!user) {
            router.push("/auth/login");
            return;
          }
          addItem({ productId: product._id, name: product.name, price: product.price, image: product.images?.[0]?.url, quantity: 1 });
        }}
      />
    </Screen>
  );
}

const createStyles = (palette: any, isRTL: boolean) =>
  StyleSheet.create({
    img: { width: "100%", height: 240, borderRadius: 18, marginBottom: 12, backgroundColor: palette.surface },
    name: { color: palette.text, fontSize: 24, fontWeight: "800", textAlign: isRTL ? "right" : "left" },
    price: { color: palette.accent, fontSize: 18, marginVertical: 4, textAlign: isRTL ? "right" : "left" },
    desc: { color: palette.muted, marginBottom: 12, textAlign: isRTL ? "right" : "left" },
  });
