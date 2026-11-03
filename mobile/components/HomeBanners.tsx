import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { AppState, Image, Linking, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import api from "../lib/api";
import { useTheme } from "../lib/theme";

type Banner = { _id: string; title?: string; link?: string; image: { url: string } };

export default function HomeBanners({ branchId }: { branchId?: string }) {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const [stopped, setStopped] = useState(false);
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(AppState.currentState === "active");
  const scroll = useRef<ScrollView>(null);
  const current = useRef(0);
  const dragged = useRef(false);
  const { palette } = useTheme();

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    setFocused(true);
    setBanners([]);
    current.current = 0;
    setIndex(0);
    if (branchId) {
      api.get("/banners/active", { headers: { "x-branch-id": branchId } }).then(res => {
        if (!cancelled) setBanners((res.data.data || []).filter((b: Banner) => b.image?.url));
      }).catch(() => { if (!cancelled) setBanners([]); });
    }
    return () => { cancelled = true; setFocused(false); };
  }, [branchId]));

  useEffect(() => {
    const subscription = AppState.addEventListener("change", state => setActive(state === "active"));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    scroll.current?.scrollTo({ x: current.current * width, animated: false });
  }, [width, banners]);

  useEffect(() => {
    if (banners.length < 2 || stopped || !focused || !active || !width) return;
    const timer = setInterval(() => {
      if (dragged.current) return;
      current.current = (current.current + 1) % banners.length;
      setIndex(current.current);
      scroll.current?.scrollTo({ x: current.current * width, animated: true });
    }, 5000);
    return () => clearInterval(timer);
  }, [banners.length, stopped, focused, active, width]);

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
            style={{ width, aspectRatio: 2.5 }}
            activeOpacity={banner.link ? 0.85 : 1}
            disabled={!banner.link}
            accessibilityRole={banner.link ? "link" : "image"}
            accessibilityLabel={banner.title || "Promotion"}
            onPress={() => { if (banner.link && /^https?:\/\//i.test(banner.link)) Linking.openURL(banner.link).catch(() => {}); }}
          >
            <Image source={{ uri: banner.image.url }} style={styles.image} resizeMode="cover" />
          </TouchableOpacity>
        ))}
      </ScrollView>
      {banners.length > 1 && (
        <View style={styles.dots}>
          {banners.map((banner, position) => <View key={banner._id} style={[styles.dot, { backgroundColor: palette.accent, opacity: index === position ? 1 : 0.25 }]} />)}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 20, direction: "ltr" },
  viewport: { borderRadius: 16, overflow: "hidden" },
  image: { width: "100%", height: "100%" },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 10 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
