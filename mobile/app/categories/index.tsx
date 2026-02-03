import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  TouchableOpacity,
  View,
  StyleSheet,
  Image,
} from "react-native";
import { Link } from "expo-router";
import Screen from "../../components/Screen";
import Text from "../../components/Text";
import api, { getBranchId } from "../../lib/api";
import { useTheme } from "../../lib/theme";
import { useI18n } from "../../lib/i18n";
import { StatusBar } from "expo-status-bar";

type Category = {
  _id: string;
  name: string;
  description?: string;
  imageUrl?: string;
};

export default function CategoriesScreen() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [branchId, setBranchId] = useState<string | null>(null);
  const { palette, isDark } = useTheme();
  const { t, isRTL } = useI18n();

  const fallbackLogo = isDark ? require("../../assets/shopico_logo.png") : require("../../assets/shopico_logo-black.png");

  const styles = useMemo(
    () => createStyles(palette, isRTL, isDark),
    [palette, isRTL, isDark]
  );

  const loadCategories = () => {
    api.get("/categories").then((res) => {
      setCategories(res.data.data || []);
    });
  };

  useEffect(() => {
    let mounted = true;
    getBranchId()
      .then((id) => {
        if (!mounted) return;
        setBranchId(id);
      })
      .catch(() => {});
    loadCategories();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (branchId === null) return;
    loadCategories();
  }, [branchId]);

  return (
    <Screen showBack backLabel={t("back") ?? "Back"}>
      {/* <StatusBar style={isDark ? "light" : "dark"} /> */}
      <Text weight="black" style={styles.title}>{t("shopByCategory")}</Text>

      <FlatList
        data={categories}
        keyExtractor={(c) => c._id}
        contentContainerStyle={{ paddingBottom: 16 }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        renderItem={({ item }) => (
          <Link href={`/categories/${item._id}`} asChild>
            <TouchableOpacity style={styles.card} activeOpacity={0.9}>
              <View style={styles.imageBox}>
                {item.imageUrl ? (
                  <>
                    <Image
                      source={{ uri: item.imageUrl }}
                      style={styles.imageBg}
                      blurRadius={14}
                    />
                    <View style={styles.imageOverlay} />
                    <Image
                      source={{ uri: item.imageUrl }}
                      style={styles.image}
                    />
                  </>
                ) : (
                  <Image source={fallbackLogo} style={styles.defaultImage} />
                )}
              </View>

              <View style={styles.textCol}>
                <Text weight="black" style={styles.name} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text weight="semibold" style={styles.desc} numberOfLines={2}>
                  {item.description || t("noDescription")}
                </Text>
              </View>
            </TouchableOpacity>
          </Link>
        )}
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
      color: palette.text,
      fontSize: 26,
      marginBottom: 12,
    },

    card: {
      flexDirection: 'row',
      alignItems: "center",
      gap: 14,
      padding: 14,
      backgroundColor: palette.card,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: palette.border,
      ...shadow,
    },

    imageBox: {
      width: 72,
      height: 72,
      borderRadius: 18,
      overflow: "hidden",
      backgroundColor: palette.surface,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: palette.border,
    },

    imageBg: {
      position: "absolute",
      width: "100%",
      height: "100%",
      resizeMode: "cover",
      opacity: 0.4,
      transform: [{ scale: 1.2 }],
    },

    imageOverlay: {
      position: "absolute",
      width: "100%",
      height: "100%",
      backgroundColor: isDark
        ? "rgba(0,0,0,0.2)"
        : "rgba(255,255,255,0.45)",
    },

    image: {
      width: 42,
      height: 42,
      resizeMode: "contain",
    },

    defaultImage: {
      width: 60,
      height: 60,
      aspectRatio: 1,
      resizeMode: "contain",
      tintColor: '#dedede'
    },

    textCol: {
      flex: 1,
      gap: 4,
    },

    name: {
      color: palette.text,
      fontSize: 16,
    },

    desc: {
      color: palette.muted,
      fontSize: 13,
    },
  });
};
