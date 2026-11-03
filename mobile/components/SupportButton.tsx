import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Alert, Linking, StyleSheet, TouchableOpacity } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import Text from "./Text";
import api from "../lib/api";
import { useI18n } from "../lib/i18n";

export default function SupportButton({ branchId }: { branchId?: string }) {
  const [contact, setContact] = useState<{ branchId: string; phone: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const { t, isRTL } = useI18n();

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    setContact(null);
    setLoading(Boolean(branchId));
    if (!branchId) return;
    api.get("/settings/support", { headers: { "x-branch-id": branchId } })
      .then(res => {
        if (!cancelled) setContact({ branchId, phone: res.data.data?.supportPhone || "" });
      })
      .catch(() => { if (!cancelled) setContact(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [branchId]));

  const callSupport = async () => {
    const phone = contact?.branchId === branchId ? contact?.phone : "";
    if (!phone) {
      Alert.alert(t("needSupport"), t("supportUnavailable"));
      return;
    }
    try {
      await Linking.openURL(`tel:${phone.replace(/[ ()-]/g, "")}`);
    } catch {
      Alert.alert(t("needSupport"), `${t("supportCallFailed")} ${phone}`);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.button]}
      onPress={callSupport}
      disabled={loading}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={t("needSupport")}
      accessibilityState={{ disabled: loading }}
    >
      <Feather name="phone" size={16} color="#fff" />
      <Text weight="bold" style={styles.label}>{t("needSupport")}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
    backgroundColor: "rgba(255,255,255,0.12)",
    flexShrink: 1
  },
  label: { color: "#fff", fontSize: 12, flexShrink: 1 },
});
