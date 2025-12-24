import { Link } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, Text, TextInput, View, StyleSheet, Image, TouchableOpacity } from "react-native";
import Screen from "../components/Screen";
import api from "../lib/api";
import { palette } from "../styles/theme";

interface Category {
  _id: string;
  name: string;
  imageUrl?: string;
}

interface Product {
  _id: string;
  name: string;
  price: number;
  images: { url: string }[];
}

export default function Home() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    api.get("/categories").then((res) => setCategories(res.data.data || []));
    api.get("/products").then((res) => setProducts(res.data.data || []));
  }, []);

  return (
    <Screen>
      <Text style={styles.title}>Hello shopper 👋</Text>
      <TextInput style={styles.search} placeholder="Search products" placeholderTextColor="#94a3b8" />
      <Text style={styles.section}>Featured categories</Text>
      <FlatList
        data={categories}
        horizontal
        keyExtractor={(c) => c._id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 10 }}
        renderItem={({ item }) => (
          <Link href={`/categories/${item._id}`} asChild>
            <TouchableOpacity style={styles.chip}>
              <Text style={styles.chipText}>{item.name}</Text>
            </TouchableOpacity>
          </Link>
        )}
      />
      <Text style={styles.section}>Fresh picks</Text>
      <FlatList
        data={products}
        horizontal
        keyExtractor={(p) => p._id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 12 }}
        renderItem={({ item }) => (
          <Link href={`/products/${item._id}`} asChild>
            <TouchableOpacity style={styles.product}>
              {item.images?.[0]?.url ? <Image source={{ uri: item.images[0].url }} style={styles.productImg} /> : null}
              <Text style={styles.productName}>{item.name}</Text>
              <Text style={styles.productPrice}>{item.price.toLocaleString()} SYP</Text>
            </TouchableOpacity>
          </Link>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: palette.text, fontSize: 26, fontWeight: "800", marginBottom: 8 },
  search: {
    backgroundColor: "#0b1220",
    borderRadius: 12,
    padding: 12,
    color: palette.text,
    borderWidth: 1,
    borderColor: "#1f2937",
    marginBottom: 12,
  },
  section: { color: palette.text, fontWeight: "700", marginVertical: 12 },
  chip: { backgroundColor: palette.card, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: "#1f2937" },
  chipText: { color: palette.text },
  product: { width: 180, backgroundColor: palette.card, borderRadius: 14, padding: 10, borderWidth: 1, borderColor: "#1f2937" },
  productImg: { width: "100%", height: 120, borderRadius: 12, marginBottom: 8 },
  productName: { color: palette.text, fontWeight: "700" },
  productPrice: { color: palette.accent, marginTop: 4 },
});
