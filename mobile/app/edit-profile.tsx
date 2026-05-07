import Feather from "@expo/vector-icons/Feather";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import Screen from "../components/Screen";
import Text from "../components/Text";
import api from "../lib/api";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import { useTheme } from "../lib/theme";

export default function EditProfile() {
  const router = useRouter();
  const { user, logout, setUserProfile } = useAuth();
  const { palette, isDark } = useTheme();
  const { t, isRTL } = useI18n();
  const styles = useMemo(() => createStyles(palette, isRTL, isDark), [palette, isRTL, isDark]);
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const saveProfile = async () => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPhone = phone.trim();

    if (!trimmedName || !trimmedEmail) {
      setError(t("invalidForm") ?? "Please fill all fields correctly");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const res = await api.put("/auth/me", {
        name: trimmedName,
        email: trimmedEmail,
        phone: trimmedPhone,
      });
      const profile = res.data.data.user;
      setUserProfile(profile);
      router.back();
    } catch (err: any) {
      setError(err?.response?.data?.message || t("profileUpdateFailed") || "Could not update profile");
    } finally {
      setSaving(false);
    }
  };

  const deleteProfile = async () => {
    setDeleting(true);
    setError("");
    try {
      await api.delete("/auth/me");
      await logout();
      router.replace("/auth/login");
    } catch (err: any) {
      setError(err?.response?.data?.message || t("profileDeleteFailed") || "Could not delete profile");
    } finally {
      setDeleting(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      t("deleteProfile") ?? "Delete profile",
      t("deleteProfileConfirm") ?? "This will permanently delete your account.",
      [
        { text: t("cancel") ?? "Cancel", style: "cancel" },
        { text: t("delete") ?? "Delete", style: "destructive", onPress: deleteProfile },
      ]
    );
  };

  if (!user) {
    return (
      <Screen>
        <View style={styles.emptyBox}>
          <Text weight="bold" style={styles.emptyTitle}>{t("notLoggedIn") ?? "You are not logged in"}</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace("/auth/login")}>
            <Text weight="bold" style={styles.primaryBtnText}>{t("login")}</Text>
          </TouchableOpacity>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()} activeOpacity={0.85}>
              <Feather name={isRTL ? "chevron-right" : "chevron-left"} size={22} color={palette.text} />
            </TouchableOpacity>
            <Text weight="bold" style={styles.title}>{t("editProfile") ?? "Edit profile"}</Text>
            <View style={styles.iconBtnPlaceholder} />
          </View>

          <View style={styles.form}>
            <View style={styles.field}>
              <Text weight="bold" style={styles.label}>{t("name")}</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder={t("name")}
                placeholderTextColor={palette.muted}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.field}>
              <Text weight="bold" style={styles.label}>{t("email")}</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder={t("email")}
                placeholderTextColor={palette.muted}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <View style={styles.field}>
              <Text weight="bold" style={styles.label}>{t("phone")}</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder={t("phone")}
                placeholderTextColor={palette.muted}
                keyboardType="phone-pad"
              />
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity style={[styles.primaryBtn, saving && styles.disabledBtn]} onPress={saveProfile} disabled={saving || deleting} activeOpacity={0.9}>
              {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text weight="bold" style={styles.primaryBtnText}>{t("save")}</Text>}
            </TouchableOpacity>
          </View>

          <View style={styles.dangerBox}>
            <View style={{ flex: 1 }}>
              <Text weight="bold" style={styles.dangerTitle}>{t("deleteProfile") ?? "Delete profile"}</Text>
              <Text style={styles.dangerText}>{t("deleteProfileCopy") ?? "Delete your account and sign out from this device."}</Text>
            </View>
            <TouchableOpacity style={[styles.deleteBtn, deleting && styles.disabledBtn]} onPress={confirmDelete} disabled={saving || deleting} activeOpacity={0.9}>
              {deleting ? <ActivityIndicator color="#fff" size="small" /> : <Feather name="trash-2" size={18} color="#fff" />}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const createStyles = (palette: any, isRTL: boolean, isDark: boolean) =>
  StyleSheet.create({
    content: {
      flexGrow: 1,
      gap: 20,
      paddingBottom: 24,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    iconBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    iconBtnPlaceholder: {
      width: 40,
      height: 40,
    },
    title: {
      color: palette.text,
      fontSize: 22,
      textAlign: "center",
    },
    form: {
      backgroundColor: palette.card,
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 18,
      padding: 14,
      gap: 14,
    },
    field: {
      gap: 7,
    },
    label: {
      color: palette.text,
      fontSize: 13,
      textAlign: isRTL ? "right" : "left",
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
    primaryBtn: {
      minHeight: 48,
      borderRadius: 14,
      backgroundColor: palette.accent,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 16,
    },
    primaryBtnText: {
      color: "#fff",
      fontSize: 16,
    },
    disabledBtn: {
      opacity: 0.7,
    },
    error: {
      color: "#ef4444",
      textAlign: isRTL ? "right" : "left",
    },
    dangerBox: {
      borderRadius: 18,
      borderWidth: 1,
      borderColor: isDark ? "#7f1d1d" : "#fecaca",
      backgroundColor: isDark ? "#3f1d1d" : "#fff1f2",
      padding: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    dangerTitle: {
      color: isDark ? "#fecaca" : "#991b1b",
      textAlign: isRTL ? "right" : "left",
    },
    dangerText: {
      color: isDark ? "#fecaca" : "#991b1b",
      marginTop: 4,
      textAlign: isRTL ? "right" : "left",
    },
    deleteBtn: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: "#dc2626",
      alignItems: "center",
      justifyContent: "center",
    },
    emptyBox: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
    },
    emptyTitle: {
      color: palette.text,
      fontSize: 18,
    },
  });
