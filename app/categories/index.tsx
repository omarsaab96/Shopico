import { useEffect, useState } from "react";
import { FlatList, Text, TouchableOpacity, View, StyleSheet } from "react-native";
import { Link } from "expo-router";
import Screen from "../../components/Screen";
import api from "../../lib/api";
import { palette } from "../../styles/theme";

export default function CategoriesScreen() {
  const [categories, setCategories] = useState<{ _id: string; name: string; description?: string }[]>([]);

  useEffect(() => {
    api.get("/categories").then((res) => setCategories(res.data.data || []));
  }, []);

  return (
    <Screen>
      <Text style={styles.title}>Shop by category</Text>
      <FlatList
        data={categories}
        keyExtractor={(c) => c._id}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        renderItem={({ item }) => (
          <Link href={`/categories/${item._id}`} asChild>
            <TouchableOpacity style={styles.row}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.desc}>{item.description}</Text>
            </TouchableOpacity>
          </Link>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: palette.text, fontSize: 22, fontWeight: "800", marginBottom: 12 },
  row: { padding: 12, backgroundColor: palette.card, borderRadius: 12, borderWidth: 1, borderColor: "#1f2937" },
  name: { color: palette.text, fontSize: 16, fontWeight: "700" },
  desc: { color: palette.muted },
});
