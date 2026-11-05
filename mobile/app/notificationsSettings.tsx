import { useNotifications } from "../lib/notifications";
import { useMemo, useState } from "react";
import { View, StyleSheet, Switch, TouchableOpacity, Alert, Linking } from "react-native";
import Screen from "../components/Screen";
import { useTheme } from "../lib/theme";
import { useI18n } from "../lib/i18n";
import Text from "../components/Text";
import { useRouter } from "expo-router";
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';

export default function SettingsScreen() {
  const router = useRouter();
  const { pushEnabled, promotionsEnabled, pushStatus, setPreference, enablePush } = useNotifications();
  const [saving, setSaving] = useState(false);
  const change = async (name: "pushEnabled" | "promotionsEnabled", enabled: boolean) => {
    setSaving(true);
    try { await setPreference(name, enabled); }
    catch { Alert.alert(lang === "ar" ? "تعذر حفظ الإعدادات" : "Could not save preferences"); }
    finally { setSaving(false); }
  };
  const { palette } = useTheme();
  const { lang, setLang, t, isRTL } = useI18n();
  const styles = useMemo(() => createStyles(palette, isRTL), [palette, isRTL]);

  return (
    <Screen>
      <View style={{}}>
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} onPress={() => router.back()} activeOpacity={0.85}>
          {/* <Feather name={isRTL ? "chevron-right" : "chevron-left"} size={22} color={palette.text} /> */}
          <FontAwesome6 name={isRTL ? "chevron-right" : "chevron-left"} size={18} color="black" style={{}} />

          <Text weight="bold" style={styles.title}>{t("notificationSettings") ?? "Notifications settings"}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.muted}>{t("pushNotifications")}</Text>
          <Switch disabled={saving} value={pushEnabled} onValueChange={value => void change("pushEnabled", value)} />
        </View>
      </View>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.muted}>
            {lang === "ar" ? "العروض والإعلانات" : "Promotions and announcements"}
          </Text>
          <Switch disabled={saving} value={promotionsEnabled} onValueChange={value => void change("promotionsEnabled", value)} />

        </View>

        {pushEnabled && pushStatus === "permission-required" &&
          <TouchableOpacity onPress={() => void Linking.openSettings()}>
            <Text style={styles.muted}>
              {lang === "ar" ? "اسمح بالإشعارات في إعدادات الجهاز" : "Allow notifications in device settings"}
            </Text>
          </TouchableOpacity>
        }


        {/* <TouchableOpacity onPress={() => router.push("/notifications")}>
        <Text style={styles.muted}>
        {lang === "ar" ? "عرض الإشعارات" : "View notifications"}
        </Text>
        </TouchableOpacity> */}
      </View>

      {pushEnabled && ["error", "device-required", "build-required"].includes(pushStatus) &&
        <TouchableOpacity onPress={() => void enablePush().catch(() => Alert.alert(lang === "ar" ? "تعذر تفعيل الإشعارات" : "Could not enable push notifications"))}>
          <Text style={styles.muted}>
            {pushStatus === "error" ?
              (lang === "ar" ? "إعادة محاولة تفعيل الإشعارات" : "Retry enabling notifications")
              : (lang === "ar" ? "إشعارات الدفع متاحة في نسخة التطبيق المثبتة على جهاز حقيقي" : "Push notifications require an installed build on a physical device")
            }
          </Text>
        </TouchableOpacity>
      }
      {/* <View style={styles.card}> */}
      {/* <Text style={styles.cardTitle}>{t("language")}</Text>
        <View style={styles.row}>
          {["en", "ar"].map((code) => (
            <TouchableOpacity key={code} style={[styles.pill, lang === code && styles.pillActive]} onPress={() => setLang(code as any)}>
              <Text style={styles.pillText}>{code.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </View> */}
      {/* MVP: theme selection is temporarily disabled while the app ships light-only.
        <Text style={[styles.cardTitle, { marginTop: 12 }]}>{t("theme")}</Text>
        <View style={styles.row}>
          {(["system", "light", "dark"] as const).map((opt) => (
            <TouchableOpacity key={opt} style={[styles.pill, mode === opt && styles.pillActive]} onPress={() => setMode(opt)}>
              <Text style={styles.pillText}>{t(opt)}</Text>
            </TouchableOpacity>
          ))}
        </View>
        */}
      {/* </View> */}
    </Screen>
  );
}

const createStyles = (palette: any, isRTL: boolean) =>
  StyleSheet.create({
    title: { color: palette.text, fontSize: 22, fontWeight: "800", marginBottom: 12, textAlign: isRTL ? "right" : "left" },
    card: { backgroundColor: palette.card, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: palette.border, gap: 8, marginBottom: 12 },
    muted: { color: palette.muted, textAlign: isRTL ? "right" : "left" },
    value: { color: palette.text, fontWeight: "700", textAlign: isRTL ? "right" : "left" },
    row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 },
    cardTitle: { color: palette.text, fontSize: 16, fontWeight: "700" },
    pill: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.surface,
    },
    pillActive: { backgroundColor: palette.accent, borderColor: palette.accent },
    pillText: { color: palette.text, fontWeight: "700" },
  });
