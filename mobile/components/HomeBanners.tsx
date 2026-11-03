import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useFocusEffect } from "expo-router";
import { AppState, Image, Linking, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Skeleton } from "./Skeleton";
import api from "../lib/api";
import { useTheme } from "../lib/theme";
import { useI18n } from "../lib/i18n";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Banner = { _id: string; title?: string; link?: string; image: { url: string } };

export default function HomeBanners({ branchId, refreshing = false, refreshKey = 0 }: {
  branchId?: string;
  refreshing?: boolean;
  refreshKey?: number;
}) {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [width, setWidth] = useState(0);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [stopped, setStopped] = useState(false);
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(AppState.currentState === "active");
  const scroll = useRef<ScrollView>(null);
  const current = useRef(0);
  const dragged = useRef(false);
  const { palette, isDark } = useTheme();
  const showSkeleton = loading || refreshing;
  const { t, isRTL } = useI18n();
  const insets = useSafeAreaInsets();

  const styles = useMemo(() => createStyles(palette, isRTL, isDark, insets, width), [palette, isRTL, isDark, insets, width]);

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    setFocused(true);
    setBanners([]);
    setLoading(Boolean(branchId));
    current.current = 0;
    setIndex(0);
    if (branchId) {
      api.get("/banners/active", { headers: { "x-branch-id": branchId } }).then(res => {
        if (!cancelled) setBanners((res.data.data || []).filter((b: Banner) => b.image?.url));
      }).catch(() => { if (!cancelled) setBanners([]); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }
    return () => { cancelled = true; setFocused(false); };
  }, [branchId, refreshKey]));

  useEffect(() => {
    const subscription = AppState.addEventListener("change", state => setActive(state === "active"));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    scroll.current?.scrollTo({ x: current.current * width, animated: false });
  }, [width, banners, showSkeleton]);

  useEffect(() => {
    if (showSkeleton || banners.length < 2 || stopped || !focused || !active || !width) return;
    const timer = setInterval(() => {
      if (dragged.current) return;
      current.current = (current.current + 1) % banners.length;
      setIndex(current.current);
      scroll.current?.scrollTo({ x: current.current * width, animated: true });
    }, 5000);
    return () => clearInterval(timer);
  }, [banners.length, stopped, focused, active, width, showSkeleton]);

  if (!branchId) return null;
  if (showSkeleton) {
    return (
      <View style={styles.container} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
        <View style={styles.placeholder}>
          {width > 0 && <Skeleton width={width} height={width / 2.5} borderRadius={16} colorScheme={isDark ? "dark" : "light"} />}
        </View>
      </View>
    );
  }
  if (!banners.length) return null;
  return (
    <View style={styles.container} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
      <ScrollView
        ref={scroll}
        horizontal
        pagingEnabled
        scrollEnabled={banners.length > 1}
        showsHorizontalScrollIndicator={false}
        style={styles.viewport}
        contentContainerStyle={{ flexDirection: "row" }}
        onScrollBeginDrag={() => { dragged.current = true; setStopped(true); }}
        onMomentumScrollEnd={event => {
          current.current = Math.max(0, Math.min(banners.length - 1, Math.round(event.nativeEvent.contentOffset.x / width)));
          setIndex(current.current);
        }}
      >
        {banners.map(banner => (
          <TouchableOpacity
            key={banner._id}
            style={styles.banner}
            activeOpacity={banner.link ? 0.85 : 1}
            disabled={!banner.link}
            accessibilityRole={banner.link ? "link" : "image"}
            accessibilityLabel={banner.title || "Promotion"}
            onPress={() => { if (banner.link && /^https?:\/\//i.test(banner.link)) Linking.openURL(banner.link).catch(() => { }); }}
          >
            <Image source={{ uri: banner.image.url }} style={styles.image} resizeMode="cover" />
          </TouchableOpacity>
        ))}
      </ScrollView>

      {banners.length > 1 && (
        <View style={styles.dots}>
          {banners.map((banner, position) => <View key={banner._id} style={[styles.dot, { backgroundColor: palette.accent, opacity: index === position ? 1 : 0.25, width: index === position ? 16 : 6 }]} />)}
        </View>
      )}
    </View>
  );
}


const createStyles = (palette: any, isRTL: boolean, isDark: boolean, insets: any, width: number) => {

  const hairline = isDark ? palette.border : "rgba(15, 23, 42, 0.08)";

  return StyleSheet.create({
    container: { marginBottom: 20, direction: "ltr" },
    placeholder: { width: "100%", aspectRatio: 2.5 },
    viewport: { borderRadius: 16, overflow: "hidden" },
    image: { width: "100%", height: "100%" },
    dots: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 10 },
    dot: { height: 6, borderRadius: 999, backgroundColor: hairline },

    banner: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: hairline,
      width,
      aspectRatio: 2.5
    }
  });
};