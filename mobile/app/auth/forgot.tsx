import { Link, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { TextInput, TouchableOpacity, Image, View, StyleSheet } from "react-native";
import Button from "../../components/Button";
import Screen from "../../components/Screen";
import Text from "../../components/Text";
import { useTheme } from "../../lib/theme";
import { useI18n } from "../../lib/i18n";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { goBack } from "expo-router/build/global-state/routing";

export default function Forgot() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const { palette, isDark } = useTheme();
  const { t, isRTL } = useI18n();
  const styles = useMemo(() => createStyles(palette, isDark, isRTL), [palette, isRTL]);
  const router = useRouter();

  const submit = () => {
    setSent(true);
  };

  // const goToLogin = () => {
  //   router.push("/auth/login");
  // }

  return (
    <Screen>
      <View style={{ flex: 1, paddingBottom: insets.bottom + 30, justifyContent: 'space-between', position: 'relative' }}>
        <View style={{ zIndex: 1 }}>
          <View style={{ alignItems: 'center' }}>
            <Image source={require('../../assets/shopico_logo-black.png')} style={styles.logo} />
          </View>
          <View style={styles.hero}>
            <Text weight="bold" style={styles.title}>{t("forgotPassword")}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.muted}>{t("resetCopy")}</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder={t("email")}
              placeholderTextColor={palette.muted}
              autoCapitalize="none"
            />
            {sent && <Text style={styles.success}>{t("resetSent")}</Text>}

          </View>
        </View>
        
        <View style={{ gap: 10, zIndex: 1 }}>
          <TouchableOpacity style={styles.cta} onPress={submit} >
            <Text style={styles.ctaText}>{t("sendLink")}</Text>
          </TouchableOpacity>

          {/* <Button title={t("sendLink")} onPress={submit} /> */}


          <View style={[styles.row, { justifyContent: 'center' }]}>
            <View style={{ flexDirection: 'row', gap: 5, alignItems: 'baseline' }}>
              {/* <Text>{t("donthaveAnAccount")}</Text> */}
              <TouchableOpacity onPress={goBack} >
                <Text style={styles.link}>{t("cancel")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <Image source={require('../../assets/watermark4.png')} style={styles.watermark} />
      </View>
    </Screen>
  );
}

const createStyles = (palette: any, isDark: any, isRTL: boolean) =>
  StyleSheet.create({
    logo: {
      width: 100,
      height: 100,
      objectFit: 'contain'
    },
    hero: { gap: 6, marginBottom: 18 },
    kicker: { color: palette.accent, textAlign: "left" },
    title: {
      color: palette.text, fontSize: 22,
    },
    watermark: {
      position: 'absolute',
      top: 0,
      right: -20,
      width: '100%',
      height: '100%',
      objectFit: 'contain',
      // borderWidth:3
      opacity: 0.4,
      pointerEvents: 'none',
    },
    card: {
      gap: 12,
    },
    cardTitle: { color: palette.text, fontSize: 18, textAlign: isRTL ? "right" : "left" },
    muted: { color: palette.muted },
    input: {
      backgroundColor: palette.surface,
      color: palette.text,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: palette.border,
    },
    link: { color: palette.accent },
    cta: {
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: palette.accent,
      shadowColor: palette.accent,
      shadowOpacity: isDark ? 0.3 : 0.15,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: 10
    },
    ctaText: {
      color: "#fff", fontSize: 16, fontWeight: "700"
    },
    success: { color: "#22c55e" },
    row: { flexDirection: "row", justifyContent: "space-between" },
  });
