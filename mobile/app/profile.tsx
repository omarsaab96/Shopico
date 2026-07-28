import { Link, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, View, StyleSheet, TouchableOpacity } from "react-native";
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetModalProvider, BottomSheetScrollView, BottomSheetTextInput } from "@gorhom/bottom-sheet";
import Button from "../components/Button";
import Screen from "../components/Screen";
import Text from "../components/Text";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/theme";
import { useI18n } from "../lib/i18n";
import api from "../lib/api";
import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import Entypo from '@expo/vector-icons/Entypo';
import ProgressBar from "../components/ProgressBar";
import { useCurrency } from "../lib/currency";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

export default function Profile() {
  const router = useRouter();
  const deleteSheetRef = useRef<BottomSheetModal>(null);
  const { user, logout } = useAuth();
  const { palette, isDark, mode, setMode } = useTheme();
  const { t, isRTL, lang, setLang } = useI18n();
  const insets = useSafeAreaInsets();
  const {
    currencies,
    selectedCurrency,
    selectedCurrencyId,
    setSelectedCurrencyId,
    getCurrencySymbol,
    getWalletBalance,
    refreshCurrencies,
    getMembershipThresholds,
    getMembershipLevel,
  } = useCurrency();
  const [pointsData, setPointsData] = useState<any>();
  const [settings, setSettings] = useState<any>();
  const styles = useMemo(() => createStyles(palette, isRTL, isDark, insets), [palette, isRTL, isDark, insets]);
  const [wallet, setWallet] = useState<any>();
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const renderBackdrop = useMemo(() => (props: any) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />, []);

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
    refreshCurrencies();
    api
      .get("/wallet")
      .then((res) => setWallet(res.data.data.wallet || res.data.data))
      .catch(() => setWallet(undefined));
  }, [refreshCurrencies, user]);

  useFocusEffect(
    useCallback(() => {
      if (user) refreshCurrencies();
    }, [refreshCurrencies, user])
  );

  const points = pointsData?.points ?? user?.points ?? 0;
  const formattedPoints = Number(points || 0).toLocaleString();
  const pointsPerAmount = settings?.pointsPerAmount;
  const earnRateTemplate = t("pointEarnRate");
  const earnRateCopy = pointsPerAmount
    ? earnRateTemplate.replace("{amount}", pointsPerAmount.toLocaleString())
    : undefined;

  const handleEdit = () => {
    router.push("/edit-profile");
  }

  const confirmDelete = () => {
    setDeletePassword("");
    setDeleteError("");
    setShowDeletePassword(false);
    deleteSheetRef.current?.present();
  };

  const deleteProfile = async () => {
    if (!user) return;
    if (!deletePassword) {
      setDeleteError(t("invalidForm") ?? "Please fill all fields correctly");
      return;
    }

    setDeleting(true);
    setDeleteError("");
    try {
      await api.delete("/auth/me", { data: { password: deletePassword } });
      deleteSheetRef.current?.dismiss();
      setDeletePassword("");
      await logout();
      router.replace("/auth/login");
    } catch (err: any) {
      setDeleteError(err?.response?.data?.message || t("profileDeleteFailed") || "Could not delete profile");
    } finally {
      setDeleting(false);
    }
  };

  const balance = getWalletBalance(wallet, selectedCurrency);
  const thresholds = getMembershipThresholds(settings, selectedCurrency);
  const membershipLevel = getMembershipLevel(balance, thresholds);

  const hasThresholds = Boolean(thresholds);

  const graceUntil = user?.membershipGraceUntil ? new Date(user.membershipGraceUntil) : null;
  const inGrace = !!(graceUntil && graceUntil.getTime() > Date.now() && membershipLevel !== "None");

  const currentThreshold = useMemo(() => {
    const map: Record<string, number> = {
      Silver: thresholds?.silver ?? 0,
      Gold: thresholds?.gold ?? 0,
      Platinum: thresholds?.platinum ?? 0,
      Diamond: thresholds?.diamond ?? 0,
    };
    return map[membershipLevel] || 0;
  }, [membershipLevel, thresholds]);


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
    const tones: Record<string, { cardBg: string; accent: string; badgeBg: string; badgeText: string; ring: string }> = {
      None: { cardBg: "#f8fafc", accent: "#64748b", badgeBg: "#e2e8f0", badgeText: "#0f172a", ring: "#cbd5e1" },
      Silver: { cardBg: "#f7f7f7", accent: "#94a3b8", badgeBg: "#e2e8f0", badgeText: "#0f172a", ring: "#cbd5e1" },
      Gold: { cardBg: "#fff7ed", accent: "#ea9b2b", badgeBg: "#fef3c7", badgeText: "#92400e", ring: "#fcd34d" },
      Platinum: { cardBg: "#f4f4f5", accent: "#6b7280", badgeBg: "#e4e4e7", badgeText: "#27272a", ring: "#d4d4d8" },
      Diamond: { cardBg: "#f0f9ff", accent: "#0ea5e9", badgeBg: "#e0f2fe", badgeText: "#0c4a6e", ring: "#7dd3fc" },
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
    <BottomSheetModalProvider>
      <Screen>
        <View style={{ flex: 1, justifyContent: 'space-between' }}>
          <View>
            <Text style={styles.title}>{t("profile")}</Text>

            {user ? (
              <>
                <View style={[styles.walletCard, { backgroundColor: membershipTone.cardBg, marginBottom: 20 }]}>
                  <View style={[styles.walletGlowA, { backgroundColor: membershipTone.accent }]} />
                  <View style={[styles.walletGlowB, { backgroundColor: membershipTone.accent }]} />
                  <View style={styles.walletRow}>
                    <View style={styles.walletTextCol}>
                      <View style={styles.walletHeader}>
                        <View style={{ gap: 0 }}>
                          <Text style={styles.walletLabel}>
                            {user?.name}
                          </Text>
                          <Text style={[styles.muted, { textAlign: 'left' }]}>{user?.email}</Text>
                          {/* <Entypo name="info-with-circle" size={18} color={palette.muted} /> */}
                        </View>
                        <View style={[styles.levelPill, { backgroundColor: membershipTone.badgeBg, borderColor: membershipTone.ring }]}>
                          <Feather name="award" size={14} color={membershipTone.badgeText} />
                          <Text style={[styles.levelPillText, { color: membershipTone.badgeText }]}>
                            {membershipLevel === "None" ? (t("standard") ?? "Standard") : membershipLevel}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.walletValue}>
                        <Entypo name="wallet" size={22} color={palette.text} />
                        <View style={styles.walletValueTextRow}>
                          <Text style={styles.walletValueText}>{balance.toLocaleString(undefined, { maximumFractionDigits: selectedCurrency?.isPrimary ? 0 : 2 })}</Text>
                          <Text style={{ fontWeight: "400", fontSize: 12 }}>{getCurrencySymbol(selectedCurrency)}</Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  <View style={{ marginTop: 10 }}>
                    {hasThresholds ? (
                      <>
                        <ProgressBar progress={progress} />
                        <View style={styles.walletFooterRow}>
                          {remaining > 0 && <Text style={styles.walletMiniLabel}>{t("remainingToNext") ?? "Remaining to"}{nextLabel}</Text>}
                          <Text style={styles.walletMiniValue}>
                            {remaining > 0 ? `${remaining.toLocaleString()} ${getCurrencySymbol(selectedCurrency)}` : t("congrats") ?? "Top level"}
                          </Text>
                        </View>
                      </>
                    ) : (
                      <Text style={styles.walletMiniLabel}>{t("membershipLoadError") ?? "Could not load membership details."}</Text>
                    )}

                    {inGrace && (
                      <View style={[styles.graceBox, { borderColor: membershipTone.ring, backgroundColor: isDark ? palette.surface : "#fffaf0" }]}>
                        <Text style={styles.graceTitle}>{t("gracePeriodActive") ?? "Grace period active"}</Text>
                        <Text style={styles.graceCopy}>
                          {(t("graceKeepLevel") ?? "Keep your balance above")} {currentThreshold.toLocaleString()} {getCurrencySymbol(selectedCurrency)}
                        </Text>
                        <Text style={[styles.graceCopy, { color: palette.muted }]}>
                          {(t("graceUntil") ?? "Grace until")}: {graceUntil?.toLocaleDateString()}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                <View style={styles.card}>
                  <TouchableOpacity onPress={() => { router.push("/points") }} style={[styles.pointsBoxFull]}>
                    {/* <View> */}
                    {/* <Text style={[styles.pointsValue, { flexDirection: 'row', alignItems: 'center', gap: 5 }]}>
                      <MaterialCommunityIcons name="star-four-points-circle" size={24} color="black" />
                      {t("points")}
                      <Entypo name="info-with-circle" size={16} color={palette.muted} />
                    </Text> */}

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <MaterialCommunityIcons name="star-four-points-circle" size={22} color="black" />
                      <Text style={[styles.pointsValue, { flexDirection: 'row', alignItems: 'center', gap: 5 }]}>
                        {t("points")}
                      </Text>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5 }}>
                      <Text style={[styles.pointsValue]}>
                        {formattedPoints}
                      </Text>
                      <Entypo name={isRTL ? "chevron-left" : "chevron-right"} size={20} color={palette.muted} />
                    </View>

                    {/* </View> */}
                    {/* {earnRateCopy && <Text style={styles.muted}>{earnRateCopy}</Text>} */}
                    {/* <TouchableOpacity style={styles.pointsLink} onPress={() => { router.push("/points") }}>
                      <Text style={styles.link}>{t("learnMore")}</Text>
                    </TouchableOpacity> */}
                  </TouchableOpacity>
                </View>

                <View style={styles.card}>
                  <View style={{ padding: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ justifyContent: 'flex-start', }}>
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5, marginBottom: 5 }}>
                        {/* <View style={styles.walletBadgeRow}>
                          <View style={[styles.levelPill, { backgroundColor: membershipTone.badgeBg, borderColor: membershipTone.ring }]}>
                            <Feather name="award" size={14} color={membershipTone.badgeText} />
                            <Text style={[styles.levelPillText, { color: membershipTone.badgeText }]}>
                              {membershipLevel === "None" ? (t("standard") ?? "Standard") : membershipLevel}
                            </Text>
                          </View>
                        </View> */}
                      </View>
                      <View style={styles.emailRow}>
                        <Text style={[styles.muted, { textAlign: 'left' }]}>{user?.email}</Text>
                        {user?.emailVerified ? (
                          <View style={styles.verifiedPill}>
                            <Feather name="check-circle" size={13} color="#16a34a" />
                            <Text style={styles.verifiedPillText}>{t("verified") ?? "Verified"}</Text>
                          </View>
                        ) : (
                          <TouchableOpacity style={styles.verifyEmailBtn} onPress={() => router.push("/email-verification?returnTo=/profile" as any)} activeOpacity={0.85}>
                            <Feather name="mail" size={13} color={palette.accent} />
                            <Text style={styles.verifyEmailText}>{t("verifyEmail") ?? "Verify email"}</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                    <View>
                      <TouchableOpacity style={styles.btn} onPress={() => { handleEdit() }}>
                        <Feather name="edit-3" size={18} color={palette.text} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* <Text style={styles.muted}>
                {t("role")}: {user?.role || "-"}
                </Text> */}

                  <View style={{ borderTopWidth: 1, borderColor: palette.border, flexDirection: 'row' }}>
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
                        {t("WalletBalance")} ({getCurrencySymbol(selectedCurrency)})
                        {/* <Entypo name="info-with-circle" size={16} color={palette.muted} /> */}
                      </Text>
                      <Text style={styles.pointsValue}>
                        {balance.toLocaleString(undefined, { maximumFractionDigits: selectedCurrency?.isPrimary ? 0 : 2 })}
                      </Text>
                      {/* {earnRateCopy && <Text style={styles.muted}>{earnRateCopy}</Text>} */}
                      <TouchableOpacity style={styles.pointsLink} onPress={() => { router.push("/wallet") }}>
                        <Text style={styles.link}>{t("learnMore")}</Text>
                      </TouchableOpacity>
                    </TouchableOpacity>
                  </View>
                </View>
              </>
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
                  <View style={styles.profileLink}>
                    <Text style={styles.profileLinkText}>{t("currency") ?? "Currency"}</Text>
                    <View style={styles.inlineRow}>
                      {currencies.map((currency) => (
                        <TouchableOpacity
                          key={currency._id}
                          style={[styles.pill, (selectedCurrencyId || selectedCurrency?._id) === currency._id && styles.pillActive]}
                          onPress={() => setSelectedCurrencyId(currency._id)}
                        >
                          <Text style={[styles.pillText, (selectedCurrencyId || selectedCurrency?._id) === currency._id && styles.pillActiveText]}>
                            {getCurrencySymbol(currency)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
                {user && (
                  <TouchableOpacity style={[styles.profileLink, styles.isLast]} onPress={() => { router.push("/addresses") }} >
                    <Text style={styles.profileLinkText}>{t("savedAddresses") ?? "Addresses"}</Text>
                    <Entypo name={isRTL ? "chevron-left" : "chevron-right"} size={20} color={palette.text} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* {user && (
              <TouchableOpacity style={styles.deleteAccountBox} onPress={confirmDelete} disabled={deleting} activeOpacity={0.9}>
                <View style={{ flex: 1 }}>
                  <Text weight="bold" style={styles.deleteAccountTitle}>{t("deleteProfile") ?? "Delete profile"}</Text>
                  <Text style={styles.deleteAccountText}>{t("deleteProfileCopy") ?? "Delete your account and sign out from this device."}</Text>
                </View>
                {deleting ? (
                  <ActivityIndicator color="#dc2626" size="small" />
                ) : (
                  <Feather name="trash-2" size={20} color="#dc2626" />
                )}
              </TouchableOpacity>
            )} */}
          </View>

          {user && <View style={{ paddingBottom: 16 }}>
            <Button title={t("logout")} onPress={logout} secondary />
          </View>}
        </View>

      </Screen >
      <BottomSheetModal
        ref={deleteSheetRef}
        snapPoints={["50%", "62%"]}
        enablePanDownToClose
        keyboardBehavior="extend"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        backdropComponent={renderBackdrop}
        onDismiss={() => {
          setDeletePassword("");
          setDeleteError("");
          setShowDeletePassword(false);
        }}
        backgroundStyle={{ backgroundColor: palette.card, borderRadius: 20 }}
        handleIndicatorStyle={{ backgroundColor: palette.muted }}
      >
        <BottomSheetScrollView contentContainerStyle={styles.sheetContainer} keyboardShouldPersistTaps="handled">
          <Text weight="bold" style={styles.sheetTitle}>{t("deleteProfile") ?? "Delete profile"}</Text>
          <Text style={styles.sheetText}>
            {t("deleteProfileConfirmWallet") ?? "This is not reversible. Your wallet will be deleted and your money will be gone."}
          </Text>

          <View style={styles.sheetField}>
            <Text weight="bold" style={styles.sheetLabel}>{t("password")}</Text>
            <View style={styles.passwordInputWrap}>
              <BottomSheetTextInput
                style={[styles.input, styles.passwordInput]}
                value={deletePassword}
                onChangeText={setDeletePassword}
                placeholder={t("password")}
                placeholderTextColor={palette.muted}
                secureTextEntry={!showDeletePassword}
                onFocus={() => deleteSheetRef.current?.snapToIndex(1)}
              />
              <TouchableOpacity style={styles.passwordToggle} onPress={() => setShowDeletePassword((value) => !value)} activeOpacity={0.8}>
                <Feather name={showDeletePassword ? "eye-off" : "eye"} size={20} color={palette.muted} />
              </TouchableOpacity>
            </View>
          </View>

          {deleteError ? <Text style={styles.error}>{deleteError}</Text> : null}

          <View style={styles.sheetActions}>
            <TouchableOpacity style={[styles.sheetButton, styles.sheetButtonSecondary]} onPress={() => deleteSheetRef.current?.dismiss()} disabled={deleting}>
              <Text weight="bold" style={styles.sheetButtonTextSecondary}>{t("cancel") ?? "Cancel"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.sheetButton, styles.sheetButtonDanger, deleting && styles.disabledBtn]} onPress={deleteProfile} disabled={deleting}>
              {deleting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text weight="bold" style={styles.sheetButtonTextPrimary}>{t("delete") ?? "Delete"}</Text>
              )}
            </TouchableOpacity>
          </View>
        </BottomSheetScrollView>
      </BottomSheetModal>
    </BottomSheetModalProvider>
  );
}


const createStyles = (palette: any, isRTL: boolean, isDark: boolean, insets: any) => {
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
      color: palette.text, textAlign: 'left'
    },
    profileLinks: {
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 20,
      backgroundColor: palette.card
    },
    profileLink: {
      paddingVertical: 10,
      paddingHorizontal: 15,
      borderBottomWidth: 1,
      borderColor: palette.border,
      flexDirection: 'row',
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
    deleteAccountBox: {
      borderRadius: 18,
      borderWidth: 1,
      borderColor: isDark ? "#7f1d1d" : "#fecaca",
      backgroundColor: isDark ? "#3f1d1d" : "#fff1f2",
      padding: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginTop: 14,
    },
    deleteAccountTitle: {
      color: isDark ? "#fecaca" : "#991b1b",
    },
    deleteAccountText: {
      color: isDark ? "#fecaca" : "#991b1b",
      marginTop: 4,
      fontSize: 13,
      lineHeight: 18,
    },
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
      textAlign: 'left'
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
    emailRow: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 8,
    },
    verifyEmailBtn: {
      minHeight: 28,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      paddingHorizontal: 9,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: palette.accent,
      backgroundColor: palette.surface,
    },
    verifyEmailText: {
      color: palette.accent,
      fontSize: 12,
      fontWeight: "800",
    },
    verifiedPill: {
      minHeight: 28,
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 9,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: isDark ? "#14532d" : "#bbf7d0",
      backgroundColor: isDark ? "#052e16" : "#f0fdf4",
    },
    verifiedPillText: {
      color: "#16a34a",
      fontSize: 12,
      fontWeight: "800",
    },

    pointsBox: {
      flex: 1,
      alignItems: "center",
      justifyContent: "space-between",
      padding: 15,
      overflow: 'hidden'
    },

    pointsBoxFull: {
      flexDirection: 'row',
      alignItems: "baseline",
      justifyContent: "space-between",
      paddingHorizontal: 15,
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
      fontSize: 20,
      fontWeight: "900",
      marginVertical: 10,
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
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: palette.card,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: palette.border
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

    walletLabel: { color: palette.text, fontSize: 20, fontWeight: "700", textAlign: align, lineHeight: 24 },
    walletValue: { flexDirection: 'row', gap: 5, alignItems: 'center' },
    walletValueTextRow: { flexDirection: 'row', gap: 5, alignItems: 'baseline' },
    walletValueText: { color: palette.text, fontSize: 28, lineHeight: 40, fontWeight: "900", textAlign: align },

    walletBadgeRow: { flexDirection: 'row', justifyContent: isRTL ? "flex-end" : "flex-start" },
    levelPill: {
      flexDirection: 'row',
      alignItems: "center",
      borderRadius: 999,
      backgroundColor: palette.surface,
      paddingVertical: 5,
      paddingHorizontal: 6
    },
    levelPillText: { fontWeight: "800", fontSize: 12, lineHeight: 12 },

    walletMini: {
      paddingTop: 5
    },
    walletMiniLabel: { color: palette.muted, fontWeight: "800", fontSize: 12, textAlign: align },
    walletMiniValue: { color: palette.text, fontWeight: "900", fontSize: 13, marginTop: 4, textAlign: align },
    walletMiniHint: { color: palette.muted, fontWeight: "700", fontSize: 12, marginTop: 2, textAlign: align },
    sheetContainer: {
      padding: 16,
      // paddingBottom: insets.bottom,
      gap: 14,
    },
    sheetTitle: {
      color: palette.text,
      fontSize: 18,
      textAlign: align,
    },
    sheetText: {
      color: isDark ? "#fecaca" : "#dc2626",
      lineHeight: 20,
      fontWeight: "700",
      textAlign: align,
    },
    sheetField: {
      gap: 7,
    },
    sheetLabel: {
      color: palette.text,
      fontSize: 13,
      textAlign: align,
    },
    input: {
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 12,
      color: palette.text,
      paddingHorizontal: 12,
      paddingVertical: 12,
      textAlign: isRTL ? "right" : "left",
    },
    passwordInputWrap: {
      position: "relative",
    },
    passwordInput: {
      paddingRight: isRTL ? 12 : 46,
      paddingLeft: isRTL ? 46 : 12,
    },
    passwordToggle: {
      position: "absolute",
      top: 0,
      bottom: 0,
      right: isRTL ? undefined : 12,
      left: isRTL ? 12 : undefined,
      width: 28,
      alignItems: "center",
      justifyContent: "center",
    },
    error: {
      color: "#ef4444",
      textAlign: align,
    },
    disabledBtn: {
      opacity: 0.7,
    },
    sheetActions: {
      flexDirection: "row",
      gap: 10,
      marginTop: 4,
    },
    sheetButton: {
      flex: 1,
      minHeight: 46,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: palette.border,
    },
    sheetButtonSecondary: {
      backgroundColor: palette.surface,
    },
    sheetButtonDanger: {
      backgroundColor: "#dc2626",
      borderColor: "#dc2626",
    },
    sheetButtonTextSecondary: {
      color: palette.text,
    },
    sheetButtonTextPrimary: {
      color: "#fff",
    },
    graceBox: {
      marginTop: 10,
      padding: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.surface,
      gap: 4,
    },
    graceTitle: { color: palette.accent, fontWeight: "800", fontSize: 13 },
    graceCopy: { color: palette.text, fontSize: 12 },
    walletFooterRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 5 },
    walletHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  });
};
