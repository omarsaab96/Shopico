import { useEffect, useMemo, useState } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import Screen from "../components/Screen";
import Text from "../components/Text";
import api from "../lib/api";
import { useTheme } from "../lib/theme";
import { useI18n } from "../lib/i18n";
import AntDesign from "@expo/vector-icons/AntDesign";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Canvas,
  Path,
  Skia,
  SweepGradient,
  vec,
} from "@shopify/react-native-skia";

const SIZE = 200;
const STROKE = 16;
const RADIUS = (SIZE - STROKE) / 2;
const CENTER = SIZE / 2;

export default function PointsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette } = useTheme();
  const { t, isRTL } = useI18n();

  const [points, setPoints] = useState(0);
  const [threshold, setThreshold] = useState(100);

  useEffect(() => {
    api.get("/points").then((res) => {
      setPoints(res.data.data.points || 0);
      setThreshold(res.data.data.rewardThreshold || 100);
    });
  }, []);

  const progress = Math.min(1, points / threshold);
  const remaining = Math.max(0, threshold - points);

  const styles = useMemo(() => createStyles(palette, isRTL, insets), [palette, isRTL]);

  // Arc path (starts from TOP)
  const arcPath = useMemo(() => {
    const path = Skia.Path.Make();
    path.addArc(
      {
        x: STROKE / 2,
        y: STROKE / 2,
        width: SIZE - STROKE,
        height: SIZE - STROKE,
      },
      -90, // start at top
      progress * 360
    );
    return path;
  }, [progress]);

  return (
    <Screen showBack backLabel={t("back") ?? "Back"}>
      <Text weight="bold" style={styles.title}>{t("pointsBalance") ?? "Points balance"}</Text>

      <View style={styles.card}>
        {/* RING */}
        <View style={styles.ringWrap}>
          <Canvas style={{ width: SIZE, height: SIZE }}>
            {/* Track */}
            <Path
              path={Skia.Path.Make().addCircle(CENTER, CENTER, RADIUS)}
              color="#ffe7d2"
              style="stroke"
              strokeWidth={STROKE}
            />

            {/* Progress */}
            <Path
              path={arcPath}
              style="stroke"
              strokeWidth={STROKE}
              strokeCap="round"
            >
              <SweepGradient
                c={vec(CENTER, CENTER)}
                colors={["#f97316", "#fb923c"]}
              />
            </Path>
          </Canvas>

          {/* Center */}
          <View style={styles.center}>
            <Text weight="black" style={styles.points}>{points}</Text>
            <Text weight="bold" style={styles.pointsLabel}>{t("rewards") ?? "Points"}</Text>
          </View>
        </View>

        {/* Gift */}
        <View style={styles.giftWrap}>
          <View style={styles.giftIcon}>
            <AntDesign name="gift" size={36} color="#f97316" />
          </View>
          <Text weight="bold" style={styles.remaining}>
            {remaining.toLocaleString()}{" "}
            {t("pointsLeft") ?? "points left to unlock a reward"}
          </Text>
        </View>

        {/* CTA */}
        <TouchableOpacity style={styles.cta} onPress={() => router.push("/(tabs)/cart")}>
          <Text weight="bold" style={styles.ctaText}>
            {t("usePoints") ?? "Use points reward"}
          </Text>
        </TouchableOpacity>
      </View>
    </Screen>
  );
}

/* ================= STYLES ================= */

const createStyles = (palette: any, isRTL: boolean, insets: any) =>
  StyleSheet.create({
    title: {
      fontSize: 22,
      color: palette.text,
      marginBottom: 12,
      textAlign: "left",
    },

    card: {
      borderRadius: 26,
      padding: 20,
      alignItems: "center",
      flex: 1,
      marginBottom: insets.bottom,
      justifyContent:'space-between'
    },

    ringWrap: {
      width: SIZE,
      height: SIZE,
      alignItems: "center",
      justifyContent: "center",
    },

    center: {
      position: "absolute",
      width: SIZE - STROKE * 2,
      height: SIZE - STROKE * 2,
      borderRadius: (SIZE - STROKE * 2) / 2,
      backgroundColor: palette.card,
      alignItems: "center",
      justifyContent: "center",
    },

    points: {
      fontSize: 36,
      color: palette.text,
    },

    pointsLabel: {
      fontSize: 14,
      color: palette.muted,
    },

    giftWrap: {
      alignItems: "center",
      gap: 10,
      marginTop: 14,
    },

    giftIcon: {
      width: 80,
      height: 80,
      borderRadius: 20,
      backgroundColor: "#fff3e8",
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOpacity: 0.06,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 8 },
      elevation: 2,
    },

    remaining: {
      fontSize: 14,
      textAlign: "center",
      color: palette.text,
    },

    cta: {
      marginTop: 16,
      width: "100%",
      paddingVertical: 14,
      borderRadius: 18,
      backgroundColor: "#f97316",
      alignItems: "center",
      shadowColor: "#f97316",
      shadowOpacity: 0.3,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 10 },
      elevation: 3,
    },

    ctaText: {
      color: "#fff",
      fontSize: 15,
    },
  });
