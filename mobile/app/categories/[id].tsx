import { useLocalSearchParams, Link } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { FlatList, Text, TouchableOpacity, View, StyleSheet, Image } from "react-native";
import Screen from "../../components/Screen";
import api from "../../lib/api";
import { useTheme } from "../../lib/theme";
import { useI18n } from "../../lib/i18n";

export default function CategoryDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [products, setProducts] = useState<any[]>([]);
  const { palette } = useTheme();
  const { t, isRTL } = useI18n();
  const styles = useMemo(() => createStyles(palette, isRTL), [palette, isRTL]);

  useEffect(() => {
    api.get(`/products?category=${id}`).then((res) => setProducts(res.data.data || []));
  }, [id]);

  return (
    <Screen>
      <Text style={styles.title}>{t("products")}</Text>
      <FlatList
        data={products}
        keyExtractor={(p) => p._id}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => (
          <Link href={`/products/${item._id}`} asChild>
            <TouchableOpacity style={styles.row}>
              <Image
                source={{ uri: item.images?.[0]?.url || "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=640&q=80&auto=format&fit=crop" }}
                style={styles.img}
              />
              <View style={{ flex: 1 }}>
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

const createStyles = (palette: any, isRTL: boolean) =>
  StyleSheet.create({
    title: { color: palette.text, fontSize: 22, fontWeight: "800", marginBottom: 12, textAlign: isRTL ? "right" : "left" },
    row: {
      backgroundColor: palette.card,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: palette.border,
      flexDirection: "row",
      gap: 10,
      alignItems: "center",
    },
    img: { width: 64, height: 64, borderRadius: 12, backgroundColor: palette.surface },
    name: { color: palette.text, fontWeight: "700" },
    price: { color: palette.accent },
  });
