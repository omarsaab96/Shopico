import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Image, Text, View, StyleSheet } from "react-native";
import Button from "../../components/Button";
import Screen from "../../components/Screen";
import api from "../../lib/api";
import { useCart } from "../../lib/cart";
import { palette } from "../../styles/theme";

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [product, setProduct] = useState<any>();
  const { addItem } = useCart();

  useEffect(() => {
    api.get(`/products/${id}`).then((res) => setProduct(res.data.data));
  }, [id]);

  if (!product) return null;

  return (
    <Screen>
      {product.images?.[0]?.url ? <Image source={{ uri: product.images[0].url }} style={styles.img} /> : null}
      <Text style={styles.name}>{product.name}</Text>
      <Text style={styles.price}>{product.price?.toLocaleString()} SYP</Text>
      <Text style={styles.desc}>{product.description}</Text>
      <Button
        title="Add to cart"
        onPress={() =>
          addItem({ productId: product._id, name: product.name, price: product.price, image: product.images?.[0]?.url, quantity: 1 })
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  img: { width: "100%", height: 240, borderRadius: 18, marginBottom: 12 },
  name: { color: palette.text, fontSize: 24, fontWeight: "800" },
  price: { color: palette.accent, fontSize: 18, marginVertical: 4 },
  desc: { color: palette.muted, marginBottom: 12 },
});
