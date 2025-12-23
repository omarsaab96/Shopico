import { useLocalSearchParams, Link } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, Text, TouchableOpacity, View, StyleSheet, Image } from "react-native";
import Screen from "../../components/Screen";
import api from "../../lib/api";
import { palette } from "../../styles/theme";

export default function CategoryDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    api.get(`/products?category=${id}`).then((res) => setProducts(res.data.data || []));
  }, [id]);

  return (
    <Screen>
      <Text style={styles.title}>Products</Text>
      <FlatList
        data={products}
        keyExtractor={(p) => p._id}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => (
          <Link href={`/products/${item._id}`} asChild>
            <TouchableOpacity style={styles.row}>
              {item.images?.[0]?.url ? <Image source={{ uri: item.images[0].url }} style={styles.img} /> : null}
              <View>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.price}>{item.price.toLocaleString()} SYP</Text>
              </View>
            </TouchableOpacity>
          </Link>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: palette.text, fontSize: 22, fontWeight: "800", marginBottom: 12 },
  row: {
    backgroundColor: palette.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#1f2937",
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  img: { width: 64, height: 64, borderRadius: 12 },
  name: { color: palette.text, fontWeight: "700" },
  price: { color: palette.accent },
});
