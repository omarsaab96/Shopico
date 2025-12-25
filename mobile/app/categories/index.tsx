import { useEffect, useMemo, useState } from "react";
import { FlatList, Text, TouchableOpacity, View, StyleSheet, Image } from "react-native";
import { Link } from "expo-router";
import Screen from "../../components/Screen";
import api from "../../lib/api";
import { useTheme } from "../../lib/theme";
import { useI18n } from "../../lib/i18n";

export default function CategoriesScreen() {
  const [categories, setCategories] = useState<{ _id: string; name: string; description?: string }[]>([]);
  const { palette } = useTheme();
  const { t, isRTL } = useI18n();
  const styles = useMemo(() => createStyles(palette, isRTL), [palette, isRTL]);

  useEffect(() => {
    api.get("/categories").then((res) => setCategories(res.data.data || []));
  }, []);

  return (
    <Screen>
      <Text style={styles.title}>{t("shopByCategory")}</Text>
      <FlatList
        data={categories}
        keyExtractor={(c) => c._id}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        renderItem={({ item }) => (
          <Link href={`/categories/${item._id}`} asChild>
            <TouchableOpacity style={styles.row}>
              <Image
                source={{
                  uri:
                    // eslint-disable-next-line max-len
                    (item as any).imageUrl ||
                    "https://images.unsplash.com/photo-1580915411954-282cb1c9d5e1?w=400&q=80&auto=format&fit=crop",
                }}
                style={styles.img}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.desc}>{item.description || t("noDescription")}</Text>
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
      padding: 12,
      backgroundColor: palette.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.border,
      flexDirection: "row",
      gap: 12,
      alignItems: "center",
    },
    img: { width: 60, height: 60, borderRadius: 12, backgroundColor: palette.surface },
    name: { color: palette.text, fontSize: 16, fontWeight: "700" },
    desc: { color: palette.muted },
  });
