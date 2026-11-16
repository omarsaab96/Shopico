import { useEffect } from "react";
import { ScrollView, TouchableOpacity, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useRouter } from "expo-router";
import Screen from "../components/Screen";
import Text from "../components/Text";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import { useTheme } from "../lib/theme";
import { formatProfilePhone } from "../lib/phone";

export default function PhoneVerification() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { t, isRTL } = useI18n();
  const { palette } = useTheme();
  useEffect(() => { if (!loading && !user) router.replace("/auth/login"); }, [loading, user, router]);
  return <Screen>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("back")}
      onPress={() => router.canGoBack() ? router.back() : router.replace("/profile")}
      style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: palette.card, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: palette.border, alignSelf: "flex-start", marginBottom: 10 }}>
      <Feather name={isRTL ? "arrow-right" : "arrow-left"} size={21} color={palette.text} />
    </TouchableOpacity>
    <ScrollView contentContainerStyle={{ paddingTop: 20, gap: 14, paddingBottom: 24 }}>
      <Text weight="bold" style={{ color: palette.text, fontSize: 24, textAlign: "center" }}>{t("verifyPhone")}</Text>
      <Text style={{ color: palette.text, fontSize: 16, textAlign: "center" }}>{t("verifyPhoneDescription")}</Text>
      <Text weight="bold" style={{ color: palette.text, fontSize: 18, textAlign: "center", writingDirection: "ltr" }}>{formatProfilePhone(user)}</Text>
      {user?.phoneVerified ? <Text style={{ color: "#16a34a", textAlign: "center" }}>{t("verified")}</Text> : null}
      {!user?.phone && <TouchableOpacity onPress={() => router.push("/edit-profile")} accessibilityRole="button">
        <Text style={{ color: palette.accent, textAlign: "center" }}>{t("addPhoneFirst")}</Text>
      </TouchableOpacity>}
      <Text style={{ color: palette.muted, textAlign: "center" }}>{t("phoneVerificationComingSoon")}</Text>
      <View>
        <TouchableOpacity disabled accessibilityRole="button" accessibilityState={{ disabled: true }}
          style={{ marginTop: 16, paddingVertical: 14, borderRadius: 18, backgroundColor: palette.accent, opacity: 0.5, alignItems: "center" }}>
          <Text weight="bold" style={{ color: "#fff", fontSize: 15 }}>{t("sendCode")}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  </Screen>;
}
