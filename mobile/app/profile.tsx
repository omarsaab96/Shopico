import { Link } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Text, View, StyleSheet, TouchableOpacity } from "react-native";
import Button from "../components/Button";
import Screen from "../components/Screen";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/theme";
import { useI18n } from "../lib/i18n";
import api from "../lib/api";
import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import Entypo from '@expo/vector-icons/Entypo';
import ProgressBar from "../components/ProgressBar";

export default function Profile() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { palette, isDark, mode, setMode } = useTheme();
  const { t, isRTL, lang, setLang } = useI18n();
  const [pointsData, setPointsData] = useState<any>();
  const [settings, setSettings] = useState<any>();
  const styles = useMemo(() => createStyles(palette, isRTL, isDark), [palette, isRTL]);
  const [wallet, setWallet] = useState<any>();

  useEffect(() => {
    let mounted = true;
    if (!user) {
      setPointsData(undefined);
      setSettings(undefined);
      return;
    }
    Promise.allSettled([api.get("/points"), api.get("/settings")]).then(([pointsRes, settingsRes]) => {
      if (!mounted) return;
      if (pointsRes.status === "fulfilled") setPointsData(pointsRes.value.data.data);
      if (settingsRes.status === "fulfilled") setSettings(settingsRes.value.data.data);
    });
    return () => {
      mounted = false;
    };
  }, [user]);

  useEffect(() => {
    if (!user) {
      setWallet(undefined);
      return;
    }
    api
      .get("/wallet")
      .then((res) => setWallet(res.data.data.wallet || res.data.data))
      .catch(() => setWallet(undefined));
  }, [user]);

  const points = pointsData?.points ?? user?.points ?? 0;
  const formattedPoints = Number(points || 0).toLocaleString();
  const pointsPerAmount = settings?.pointsPerAmount;
  const earnRateTemplate = t("pointEarnRate");
  const earnRateCopy = pointsPerAmount
    ? earnRateTemplate.replace("{amount}", pointsPerAmount.toLocaleString())
    : undefined;

  const handleEdit = () => {
    console.log('edit profile clicked')
  }
  const balance = wallet?.balance || 0;
  const membershipLevel = user?.membershipLevel || "None";
  const thresholds = settings?.membershipThresholds || {
    silver: 1000000,
    gold: 2000000,
    platinum: 4000000,
    diamond: 6000000,
  };

  const { nextLabel, remaining, progress } = useMemo(() => {
    const levels = [
      { name: "None", min: 0 },
      { name: "Silver", min: thresholds.silver },
      { name: "Gold", min: thresholds.gold },
      { name: "Platinum", min: thresholds.platinum },
      { name: "Diamond", min: thresholds.diamond },
    ];
    const currentIdx = levels.findIndex((l) => l.name === membershipLevel);
    const next = levels[currentIdx + 1];
    if (!next) return { nextLabel: "Max", remaining: 0, progress: 1 };

    const remaining = Math.max(0, next.min - balance);
    const range = next.min - levels[currentIdx].min || 1;
    const progress = Math.min(1, (balance - levels[currentIdx].min) / range);
    return { nextLabel: next.name, remaining, progress };
  }, [balance, membershipLevel, thresholds]);

  const membershipTone = useMemo(() => {
    // “Card tone” for light mode (orange-first like the reference).
    // In dark mode we keep it calm and rely on palette colors.
    const tones: Record<
      string,
      { cardBg: string; accent: string; badgeBg: string; badgeText: string; ring: string }
    > = {
      None: { cardBg: "#fff7ed", accent: "#f97316", badgeBg: "#ffedd5", badgeText: "#9a3412", ring: "#fdba74" },
      Silver: { cardBg: "#fff7ed", accent: "#fb923c", badgeBg: "#ffedd5", badgeText: "#9a3412", ring: "#fdba74" },
      Gold: { cardBg: "#fff7ed", accent: "#f97316", badgeBg: "#ffedd5", badgeText: "#9a3412", ring: "#fdba74" },
      Platinum: { cardBg: "#fff7ed", accent: "#f97316", badgeBg: "#ffedd5", badgeText: "#9a3412", ring: "#fdba74" },
      Diamond: { cardBg: "#fff7ed", accent: "#f97316", badgeBg: "#ffedd5", badgeText: "#9a3412", ring: "#fdba74" },
    };

    const base = tones[membershipLevel] || tones.None;

    if (isDark) {
      return {
        cardBg: palette.card,
        accent: palette.accent,
        badgeBg: palette.surface,
        badgeText: palette.text,
        ring: palette.border,
      };
    }

    return base;
  }, [membershipLevel, isDark, palette]);

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'space-between' }}>
        <View>
          <Text style={styles.title}>{t("profile")}</Text>
          {user ? (
            <View style={styles.card}>
              <View style={{ padding: 18, flexDirection : 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{}}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 5 }}>
                    <Text style={styles.username}>{user?.name}</Text>

                    <View style={styles.walletBadgeRow}>
                      <View style={[styles.levelPill, { backgroundColor: membershipTone.badgeBg, borderColor: membershipTone.ring }]}>
                        {/* <Feather name="award" size={14} color={membershipTone.badgeText} /> */}
                        <Text style={[styles.levelPillText, { color: membershipTone.badgeText }]}>
                          {membershipLevel === "None" ? (t("standard") ?? "Standard") : membershipLevel}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <Text style={styles.muted}>{user?.email}</Text>
                </View>
                <View>
                  <TouchableOpacity style={styles.btn} onPress={() => { handleEdit() }}>
                    <Feather name="edit-3" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* <Text style={styles.muted}>
                {t("role")}: {user?.role || "-"}
              </Text> */}

              <View style={{ borderTopWidth: 1, borderColor: palette.border, flexDirection:'row' }}>
                <TouchableOpacity onPress={() => { router.push("/points") }} style={[styles.pointsBox, styles.borderRight]}>
                  <Text style={[styles.muted]}>
                    {t("pointsBalance")}
                    {/* <Entypo name="info-with-circle" size={16} color={palette.muted} /> */}
                  </Text>
                  <Text style={styles.pointsValue}>
                    {formattedPoints}
                  </Text>
                  {/* {earnRateCopy && <Text style={styles.muted}>{earnRateCopy}</Text>} */}
                  <TouchableOpacity style={styles.pointsLink} onPress={() => { router.push("/points") }}>
                    <Text style={styles.link}>{t("learnMore")}</Text>
                  </TouchableOpacity>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => { router.push("/wallet") }} style={[styles.pointsBox]}>
                  <Text style={styles.muted}>
                    {t("WalletBalance")}
                    {/* <Entypo name="info-with-circle" size={16} color={palette.muted} /> */}
                  </Text>
                  <Text style={styles.pointsValue}>
                    {balance.toLocaleString()} <Text style={{ fontWeight: '400', fontSize: 14 }}> {t("syp")}</Text>
                  </Text>
                  {/* {earnRateCopy && <Text style={styles.muted}>{earnRateCopy}</Text>} */}
                  <TouchableOpacity style={styles.pointsLink} onPress={() => { router.push("/wallet") }}>
                    <Text style={styles.link}>{t("learnMore")}</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>
                {t("notLoggedIn") ?? "You are not logged in"}
              </Text>
              <Text style={styles.emptyText}>{t("loginToSeeProfile") ?? "Please login to view your profile."}</Text>

              <TouchableOpacity style={styles.browseBtn} onPress={() => { router.replace("/auth/login") }}>
                <Text style={styles.browseBtnText}>{t("login")}</Text>
              </TouchableOpacity>
            </View>
          )}

          <View>
            <Text style={styles.sectionTitle}>{t("settings")}</Text>
            <View style={styles.profileLinks}>
              {/* <TouchableOpacity style={styles.profileLink} onPress={() => { router.push("/settings") }}>
                <Text style={styles.profileLinkText}>{t("settings")}</Text>
                <Entypo name="chevron-right" size={20} color="black" />
              </TouchableOpacity> */}
              <View style={styles.profileLink}>
                <Text style={styles.profileLinkText}>{t("language")}</Text>
                <View style={styles.inlineRow}>
                  {["en", "ar"].map((code) => (
                    <TouchableOpacity
                      key={code}
                      style={[styles.pill, lang === code && styles.pillActive]}
                      onPress={() => setLang(code as any)}
                    >
                      <Text style={[styles.pillText, lang === code && styles.pillActiveText]}>{code.toUpperCase()}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={[styles.profileLink, !user && styles.isLast]}>
                <Text style={styles.profileLinkText}>{t("theme")}</Text>
                <View style={styles.inlineRow}>
                  {(["system", "light", "dark"] as const).map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      style={[styles.pill, mode === opt && styles.pillActive]}
                      onPress={() => setMode(opt)}
                    >
                      <Text style={[styles.pillText, mode === opt && styles.pillActiveText]}>{t(opt)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              {user && (
                <TouchableOpacity style={[styles.profileLink, styles.isLast]} onPress={() => { router.push("/addresses") }} >
                  <Text style={styles.profileLinkText}>{t("savedAddresses") ?? "Addresses"}</Text>
                  <Entypo name={isRTL?"chevron-left":"chevron-right"} size={20} color={palette.text} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {user && <View style={{ paddingBottom: 16 }}>
          <Button title={t("logout")} onPress={logout} secondary />
        </View>}
      </View>

    </Screen >
  );
}


const createStyles = (palette: any, isRTL: boolean, isDark: boolean) => {
  const hairline = isDark ? palette.border : "rgba(15, 23, 42, 0.08)";
  const align = isRTL ? ("right" as const) : ("left" as const);

  const cardShadow = {
    shadowColor: "#000",
    shadowOpacity: isDark ? 0.18 : 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: isDark ? 2 : 1,
  };

  return StyleSheet.create({
    sectionTitle: {
      marginBottom: 10,
      fontWeight: '700',
      color:palette.text
    },
    profileLinks: {
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 20
    },
    profileLink: {
      paddingVertical: 10,
      paddingHorizontal: 15,
      borderBottomWidth: 1,
      borderColor: palette.border,
      flexDirection:'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    isLast: {
      borderBottomWidth: 0,
    },
    profileLinkText: {
      fontSize: 14,
      color: palette.text,
    },
    inlineRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    pill: {
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.surface,
    },
    pillActive: { backgroundColor: palette.accent, borderColor: palette.accent },
    pillText: { color: palette.text, fontWeight: "700" },
    emptyBox: {
      backgroundColor: palette.card,
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor: palette.border,
      alignItems: "center",
      gap: 8,
      marginBottom: 20,
    },
    pillActiveText: {
      color: 'white'
    },
    emptyTitle: { color: palette.text, fontSize: 18, fontWeight: "800" },
    emptyText: { color: palette.muted, textAlign: "center" },
    browseBtn: {
      backgroundColor: palette.accent,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 10,
      marginTop: 4,
    },
    browseBtnText: { color: "#fff", fontWeight: "700" },
    card: {
      backgroundColor: palette.card,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: palette.border,
      marginBottom: 20
    },

    title: {
      color: palette.text,
      fontSize: 24,
      fontWeight: "900",
      marginBottom: 12,
    },

    username: {
      color: palette.text,
      fontSize: 18,
      fontWeight: "900",
      textAlign: isRTL ? "right" : "left",
    },

    muted: {
      color: palette.muted,
      fontSize: 13,
      lineHeight: 18,
    },

    pointsBox: {
      flex: 1,
      alignItems: "center",
      justifyContent: "space-between",
      padding: 15,
      overflow: 'hidden'
    },

    borderRight: {
      borderRightWidth: 1,
      borderColor: palette.border
    },

    borderLeft: {
      borderLeftWidth: 1,
      borderColor: palette.border
    },

    pointsValue: {
      color: palette.text,
      fontSize: 26,
      fontWeight: "900",
      textAlign: isRTL ? "right" : "left",
    },

    pointsLink: {
      alignItems: "center",
      justifyContent: "center",
    },

    pointsLinkText: {
      color: "#fff",
      fontWeight: "900",
      fontSize: 14,
    },

    link: {
      color: palette.accent,
      fontWeight: "700",
      textAlign: isRTL ? "right" : "left",
    },
    loginBtn: {
      backgroundColor: palette.accent,
      paddingVertical: 12,
      paddingHorizontal: 18,
      borderRadius: 14,
      alignItems: "center",
      width: "100%",
    },

    loginBtnText: {
      color: "#fff",
      fontWeight: "900",
      fontSize: 14,
    },

    btn: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: palette.accent,
      alignItems: "center",
      justifyContent: "center",

    },
    walletCard: {
      borderRadius: 20,
      padding: 14,
      borderWidth: 1,
      borderColor: hairline,
      overflow: "hidden",
      ...cardShadow,
    },
    walletGlowA: {
      position: "absolute",
      width: 220,
      height: 220,
      borderRadius: 999,
      opacity: isDark ? 0.08 : 0.14,
      top: -120,
      left: isRTL ? undefined : -110,
      right: isRTL ? -110 : undefined,
    },
    walletGlowB: {
      position: "absolute",
      width: 260,
      height: 260,
      borderRadius: 999,
      opacity: isDark ? 0.06 : 0.12,
      bottom: -160,
      left: isRTL ? -140 : undefined,
      right: isRTL ? undefined : -140,
    },
    walletRow: { flexDirection: 'row', gap: 12, alignItems: "flex-start" },
    walletTextCol: { flex: 1, gap: 8 },

    walletLabel: { color: palette.text, fontSize: 20, fontWeight: "700", textAlign: align },
    walletValue: { color: palette.text, fontSize: 28, fontWeight: "900", textAlign: align },

    walletBadgeRow: { flexDirection: 'row', justifyContent: isRTL ? "flex-end" : "flex-start" },
    levelPill: {
      flexDirection: 'row',
      alignItems: "center",
      borderRadius: 999,
      backgroundColor: palette.surface,
      paddingVertical: 5,
      paddingHorizontal: 10
    },
    levelPillText: { fontWeight: "800", fontSize: 12 },

    walletMini: {
      paddingTop: 5
    },
    walletMiniLabel: { color: palette.muted, fontWeight: "800", fontSize: 12, textAlign: align },
    walletMiniValue: { color: palette.text, fontWeight: "900", fontSize: 13, marginTop: 4, textAlign: align },
    walletMiniHint: { color: palette.muted, fontWeight: "700", fontSize: 12, marginTop: 2, textAlign: align },

  });
};
