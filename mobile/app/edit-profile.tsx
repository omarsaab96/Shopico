import Feather from "@expo/vector-icons/Feather";
import { useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetModalProvider, BottomSheetScrollView, BottomSheetTextInput } from "@gorhom/bottom-sheet";
import Screen from "../components/Screen";
import Text from "../components/Text";
import api from "../lib/api";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import { useTheme } from "../lib/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';

export default function EditProfile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const deleteSheetRef = useRef<BottomSheetModal>(null);
  const { user, logout, setUserProfile } = useAuth();
  const { palette, isDark } = useTheme();
  const { t, isRTL } = useI18n();
  const styles = useMemo(() => createStyles(palette, insets, isRTL, isDark), [palette, insets, isRTL, isDark]);
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [error, setError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const deleteSheetSnapPoints = useMemo(() => ["60%", "70%"], []);
  const renderBackdrop = useMemo(() => (props: any) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />, []);

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

  const changePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError(t("invalidForm") ?? "Please fill all fields correctly");
      setPasswordSuccess("");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError(t("passwordTooShort") ?? "Password must be at least 6 characters");
      setPasswordSuccess("");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t("passwordsMismatch"));
      setPasswordSuccess("");
      return;
    }

    setChangingPassword(true);
    setPasswordError("");
    setPasswordSuccess("");
    try {
      await api.put("/auth/me/password", {
        currentPassword,
        newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSuccess(t("passwordChanged") ?? "Password changed");
    } catch (err: any) {
      setPasswordError(err?.response?.data?.message || t("passwordChangeFailed") || "Could not change password");
    } finally {
      setChangingPassword(false);
    }
  };

  const deleteProfile = async () => {
    if (!deletePassword) {
      setDeleteError(t("invalidForm") ?? "Please fill all fields correctly");
      return;
    }
    setDeleting(true);
    setError("");
    setDeleteError("");
    try {
      await api.post("/auth/login", {
        email: user.email,
        password: deletePassword,
      });
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

  const confirmDelete = () => {
    setDeleteError("");
    setDeletePassword("");
    deleteSheetRef.current?.present();
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
    <BottomSheetModalProvider>
      <Screen>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
              <TouchableOpacity style={{flexDirection:'row',alignItems:'center',gap:10}} onPress={() => router.back()} activeOpacity={0.85}>
                {/* <Feather name={isRTL ? "chevron-right" : "chevron-left"} size={22} color={palette.text} /> */}
                <FontAwesome6 name={isRTL? "chevron-right":"chevron-left"} size={18} color="black" style={{}} />

                <Text weight="bold" style={styles.title}>{t("editProfile") ?? "Edit profile"}</Text>
              </TouchableOpacity>
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

            <View style={styles.form}>
              <Text weight="bold" style={styles.formTitle}>{t("changePassword") ?? "Change password"}</Text>

              <View style={styles.field}>
                <Text weight="bold" style={styles.label}>{t("currentPassword") ?? "Current password"}</Text>
                <View style={styles.passwordInputWrap}>
                  <TextInput
                    style={[styles.input, styles.passwordInput]}
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    placeholder={t("currentPassword") ?? "Current password"}
                    placeholderTextColor={palette.muted}
                    secureTextEntry={!showCurrentPassword}
                  />
                  <TouchableOpacity style={styles.passwordToggle} onPress={() => setShowCurrentPassword((value) => !value)} activeOpacity={0.8}>
                    <Feather name={showCurrentPassword ? "eye-off" : "eye"} size={20} color={palette.muted} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.field}>
                <Text weight="bold" style={styles.label}>{t("newPassword") ?? "New password"}</Text>
                <View style={styles.passwordInputWrap}>
                  <TextInput
                    style={[styles.input, styles.passwordInput]}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder={t("newPassword") ?? "New password"}
                    placeholderTextColor={palette.muted}
                    secureTextEntry={!showNewPassword}
                  />
                  <TouchableOpacity style={styles.passwordToggle} onPress={() => setShowNewPassword((value) => !value)} activeOpacity={0.8}>
                    <Feather name={showNewPassword ? "eye-off" : "eye"} size={20} color={palette.muted} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.field}>
                <Text weight="bold" style={styles.label}>{t("confirmPassword")}</Text>
                <View style={styles.passwordInputWrap}>
                  <TextInput
                    style={[styles.input, styles.passwordInput]}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder={t("confirmPassword")}
                    placeholderTextColor={palette.muted}
                    secureTextEntry={!showConfirmPassword}
                  />
                  <TouchableOpacity style={styles.passwordToggle} onPress={() => setShowConfirmPassword((value) => !value)} activeOpacity={0.8}>
                    <Feather name={showConfirmPassword ? "eye-off" : "eye"} size={20} color={palette.muted} />
                  </TouchableOpacity>
                </View>
              </View>

              {passwordError ? <Text style={styles.error}>{passwordError}</Text> : null}
              {passwordSuccess ? <Text style={styles.success}>{passwordSuccess}</Text> : null}

              <TouchableOpacity
                style={[styles.primaryBtn, changingPassword && styles.disabledBtn]}
                onPress={changePassword}
                disabled={saving || deleting || changingPassword}
                activeOpacity={0.9}
              >
                {changingPassword ? (
                  <ActivityIndicator color={palette.text} size="small" />
                ) : (
                  <Text weight="bold" style={styles.primaryBtnText}>{t("changePassword") ?? "Change password"}</Text>
                )}
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

      <BottomSheetModal
        ref={deleteSheetRef}
        snapPoints={deleteSheetSnapPoints}
        enablePanDownToClose
        keyboardBehavior="extend"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        backdropComponent={renderBackdrop}
        onDismiss={() => {
          setDeletePassword("");
          setDeleteError("");
          setShowDeletePassword(false);
          Keyboard.dismiss()
        }}
        backgroundStyle={{ backgroundColor: palette.card, borderRadius: 20 }}
        handleIndicatorStyle={{ backgroundColor: palette.muted }}
      >
        <BottomSheetScrollView
          contentContainerStyle={styles.sheetContainer}
          keyboardShouldPersistTaps="handled"
        >
          <Text weight="bold" style={styles.sheetTitle}>{t("deleteProfile") ?? "Delete profile"}</Text>
          <Text style={styles.sheetText}>
            {t("deleteProfileConfirmWallet") ?? "This is not reversible. Your wallet will be deleted and your money will be gone."}
          </Text>

          <View style={styles.sheetField}>
            <Text weight="bold" style={styles.label}>{t("password")}</Text>
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

const createStyles = (palette: any, insets: any, isRTL: boolean, isDark: boolean) =>
  StyleSheet.create({
    content: {
      flexGrow: 1,
      gap: 20,
      paddingBottom: insets.bottom + 10,
    },
    header: {
      // flexDirection: "row",
      // alignItems: "center",
      // gap: 5
      // justifyContent: "space-between",
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
      lineHeight: 22,
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
    },
    formTitle: {
      color: palette.text,
      fontSize: 16,
    },
    input: {
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 12,
      color: palette.text,
      paddingHorizontal: 12,
      paddingVertical: 12,
      textAlign:isRTL?'right':'left'
    },
    passwordInputWrap: {
      position: "relative",
    },
    passwordInput: {
      paddingRight: 46,
    },
    passwordToggle: {
      position: "absolute",
      top: 0,
      bottom: 0,
      right: 12,
      width: 28,
      alignItems: "center",
      justifyContent: "center",
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
    secondaryBtn: {
      minHeight: 48,
      borderRadius: 14,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.border,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 16,
    },
    secondaryBtnText: {
      color: palette.text,
      fontSize: 16,
    },
    disabledBtn: {
      opacity: 0.7,
    },
    error: {
      color: "#ef4444",
    },
    success: {
      color: "#16a34a",
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
    },
    dangerText: {
      color: isDark ? "#fecaca" : "#991b1b",
      marginTop: 4,
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
    sheetContainer: {
      padding: 16,
      paddingBottom: insets.bottom + 10,
      gap: 14,
    },
    sheetTitle: {
      color: palette.text,
      fontSize: 18,
    },
    sheetText: {
      color: isDark ? "#fecaca" : "#dc2626",
      lineHeight: 20,
      fontWeight: '700'
    },
    sheetField: {
      gap: 7,
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
  });
