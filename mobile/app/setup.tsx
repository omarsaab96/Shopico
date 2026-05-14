import { Redirect, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import Feather from "@expo/vector-icons/Feather";
import Screen from "../components/Screen";
import Text from "../components/Text";
import api, { getBranchId, setBranchId, setBranchLock } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import { useTheme } from "../lib/theme";
import { Skeleton } from "../components/Skeleton";
import { useCurrency } from "../lib/currency";

type Branch = { _id: string; name: string; address: string };
type SavedAddress = { _id: string; label?: string; address: string; updatedAt?: string; createdAt?: string };

export default function SetupScreen() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette, isDark } = useTheme();
  const { t, isRTL } = useI18n();
  const { refreshCurrencies } = useCurrency();
  const styles = useMemo(() => createStyles(palette, isDark, isRTL, insets), [palette, isDark, isRTL, insets]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<SavedAddress | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingBranch, setSavingBranch] = useState("");

  const loadSetup = useCallback(async () => {
    if (!user || user.role === "driver") return;
    setLoading(true);
    try {
      const [branchId, branchesRes, addressesRes] = await Promise.all([
        getBranchId(),
        api.get("/branches/public"),
        api.get("/addresses"),
      ]);
      const branchList: Branch[] = branchesRes.data.data || [];
      const addressList: SavedAddress[] = addressesRes.data.data || [];
      const sortedAddresses = [...addressList].sort(
        (a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime()
      );
      setBranches(branchList);
      setAddresses(sortedAddresses);
      setSelectedBranch(branchList.find((branch) => branch._id === branchId) || null);
      setSelectedAddress((prev) => {
        if (sortedAddresses.length === 0) return null;
        if (prev) {
          const match = sortedAddresses.find((address) => address._id === prev._id);
          if (match) return match;
        }
        return sortedAddresses[0];
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadSetup();
    }, [loadSetup])
  );

  const chooseBranch = async (branch: Branch) => {
    setSavingBranch(branch._id);
    try {
      await setBranchId(branch._id);
      await setBranchLock(true);
      await refreshCurrencies();
      setSelectedBranch(branch);
    } finally {
      setSavingBranch("");
    }
  };

  const canContinue = Boolean(selectedBranch && selectedAddress);

  useEffect(() => {
    if (loading) return;
    if (!canContinue) return;
    router.replace("/(tabs)/store");
  }, [canContinue, loading, router]);

  if (authLoading) return null;
  if (!user) return <Redirect href="/auth/login" />;
  if (user.role === "driver") return <Redirect href="/(tabs)/store" />;

  return (
    <Screen>
      <View style={{ flex: 1, paddingBottom: insets.bottom + 10, gap: 10 }}>
        <Text style={styles.title}>
          {t("completeSetupTitle") ?? "Set up your shopping location"}
        </Text>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={loadSetup} />}
        >
          <View style={styles.header}>
            <Text style={styles.copy}>
              {t("completeSetupSub1") ?? "Choose your preffered branch"}
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.stepHead}>
              <View style={[styles.stepBadge, selectedBranch && styles.stepBadgeDone]}>
                {selectedBranch ? <Feather name="check" size={16} color="#fff" /> : <Text style={styles.stepBadgeText}>1</Text>}
              </View>
              <View style={styles.stepText}>
                <Text style={styles.stepTitle}>{t("selectBranch") ?? "Select branch"}</Text>
                {/* <Text style={styles.stepSub}>
                {selectedBranch ? selectedBranch.name : (t("selectBranchCopy") ?? "Choose the branch you want to shop from.")}
              </Text> */}
              </View>
            </View>

            {loading ? (
              <>
                <Skeleton width={320} height={70} />
                <Skeleton width={220} height={70} />
              </>
            ) : branches.length === 0 ? (
              <Text style={styles.muted}>{t("noBranches") ?? "No branches available."}</Text>
            ) : (
              <View style={styles.options}>
                {branches.map((branch) => {
                  const active = selectedBranch?._id === branch._id;
                  return (
                    <TouchableOpacity
                      key={branch._id}
                      style={[styles.option, active && styles.optionActive]}
                      onPress={() => chooseBranch(branch)}
                      activeOpacity={0.9}
                      disabled={Boolean(savingBranch)}
                    >
                      <View style={styles.optionText}>
                        <Text style={styles.optionTitle}>{branch.name}</Text>
                        <Text style={styles.optionSub}>{branch.address}</Text>
                      </View>
                      {savingBranch === branch._id ? (
                        <ActivityIndicator color={palette.accent} size="small" />
                      ) : active && (
                        <Feather name="check" size={18} color={palette.accent} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          <Text style={styles.copy}>
            {t("completeSetupSub2") ?? "Set your delivery address"}
          </Text>

          <View style={styles.card}>
            <View style={styles.stepHead}>
              <View style={[styles.stepBadge, selectedAddress && styles.stepBadgeDone]}>
                {selectedAddress ? <Feather name="check" size={16} color="#fff" /> : <Text style={styles.stepBadgeText}>2</Text>}
              </View>
              <View style={styles.stepText}>
                <Text style={styles.stepTitle}>{t("selectAddress") ?? "Select address"}</Text>
              </View>
            </View>

            {loading ? (
              <>
                <Skeleton width={320} height={70} />
                <Skeleton width={220} height={70} />
              </>
            ) : addresses.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.muted}>{t("noAddresses") ?? "You do not have any saved addresses yet."}</Text>
                <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push("/addresses")} activeOpacity={0.9}>
                  <Text style={styles.primaryText}>{t("addAddress") ?? "Add address"}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={styles.options}>
                  {addresses.map((address) => {
                    const active = selectedAddress?._id === address._id;
                    return (
                      <TouchableOpacity
                        key={address._id}
                        style={[styles.option, active && styles.optionActive]}
                        onPress={() => setSelectedAddress(address)}
                        activeOpacity={0.9}
                      >
                        <View style={styles.optionText}>
                          <Text style={styles.optionTitle}>{address.label || (t("address") ?? "Address")}</Text>
                          <Text style={styles.optionSub}>{address.address}</Text>
                        </View>
                        {active && <Feather name="check" size={18} color={palette.accent} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push("/addresses")} activeOpacity={0.9}>
                  <Text style={styles.secondaryText}>{t("addNewAddress") ?? "Add a new address"}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>

        <TouchableOpacity
          style={[styles.continueBtn, !canContinue && styles.continueBtnDisabled]}
          disabled={!canContinue}
          onPress={() => router.replace("/(tabs)/store")}
          activeOpacity={0.9}
        >
          <Text style={styles.continueText}>{t("continue") ?? "Continue"}</Text>
        </TouchableOpacity>
      </View>
    </Screen>
  );
}

const createStyles = (palette: any, isDark: boolean, isRTL: boolean, insets: any) =>
  StyleSheet.create({
    scroll: { flex: 1, backgroundColor: palette.background },
    content: { gap: 14 },
    header: {},
    iconBox: {
      width: 52,
      height: 52,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: palette.accentSoft,
    },
    title: { color: palette.text, fontSize: 28, fontWeight: "900", textAlign: "left", },
    copy: { color: palette.muted, fontSize: 14, lineHeight: 20, textAlign: "left" },
    card: {
      backgroundColor: palette.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: palette.border,
      padding: 10,
      gap: 12,
      // shadowColor: "#000",
      // shadowOpacity: isDark ? 0.18 : 0.06,
      // shadowRadius: 12,
      // shadowOffset: { width: 0, height: 6 },
      // elevation: 2,
    },
    stepHead: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
    stepBadge: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.border,
    },
    stepBadgeDone: { backgroundColor: palette.accent, borderColor: palette.accent },
    stepBadgeText: { color: palette.text, fontWeight: "900" },
    stepText: { flex: 1 },
    stepTitle: { color: palette.text, fontSize: 16, fontWeight: "900", textAlign: "left" },
    stepSub: { color: palette.muted, fontSize: 13, marginTop: 3, textAlign: "left" },
    options: { gap: 8 },
    option: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 12,
      borderRadius: 12,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.border,
    },
    optionActive: {
      borderColor: palette.accent,
      backgroundColor: isDark ? palette.surface : "rgba(249,115,22,0.10)",
    },
    optionText: { flex: 1 },
    optionTitle: { color: palette.text, fontWeight: "900", textAlign: "left" },
    optionSub: { color: palette.muted, fontSize: 12, marginTop: 2, textAlign: "left" },
    loader: { marginTop: 12 },
    muted: { color: palette.muted, textAlign: "left" },
    emptyState: { gap: 12 },
    primaryBtn: { backgroundColor: palette.accent, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
    primaryText: { color: "#fff", fontWeight: "900" },
    secondaryBtn: {
      backgroundColor: palette.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.border,
      paddingVertical: 12,
      alignItems: "center",
    },
    secondaryText: { color: palette.accent, fontWeight: "900" },
    continueBtn: { backgroundColor: palette.accent, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
    continueBtnDisabled: { opacity: 0.45 },
    continueText: { color: "#fff", fontWeight: "900", fontSize: 16 },
  });
