import { Link, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { TextInput, View, StyleSheet, TouchableOpacity } from "react-native";
import Button from "../../components/Button";
import Screen from "../../components/Screen";
import Text from "../../components/Text";
import api, { storeTokens } from "../../lib/api";
import { useTheme } from "../../lib/theme";
import { useI18n } from "../../lib/i18n";
import AntDesign from '@expo/vector-icons/AntDesign';

export default function Register() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { palette } = useTheme();
  const { t, isRTL } = useI18n();
  const styles = useMemo(() => createStyles(palette, isRTL), [palette, isRTL]);

  const submit = async () => {
    try {
      const res = await api.post("/auth/register", { name, email, password });
      const { accessToken, refreshToken } = res.data.data;
      await storeTokens(accessToken, refreshToken);
      router.replace("/(tabs)/store");
    } catch (err) {
      console.error(err);
      setError(t("registerFailed"));
    }
  };

  return (
    <Screen>
      <View style={{ flex: 1, paddingTop: 50 }}>
        <View style={styles.card}>
          <Text weight="bold" style={styles.cardTitle}>{t("register")}</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder={t("name")}
            placeholderTextColor={palette.muted}
          />
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder={t("email")}
            placeholderTextColor={palette.muted}
            autoCapitalize="none"
          />
          <View style={{ position: 'relative' }}>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder={t("password")}
              secureTextEntry={!showPassword}
              placeholderTextColor={palette.muted}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.toggle}>
              {showPassword ?
                <AntDesign name="eye-invisible" size={20} color="black" />
                :
                <AntDesign name="eye" size={20} color="black" />
              }
            </TouchableOpacity>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button title={t("register")} onPress={submit} />
          <View style={[styles.row,{alignItems:'center'}]}>
            <Text>{t("alreadyHaveAnAccount")}</Text>
            <Link href="/auth/login" style={styles.link}>
              {t("login")}
            </Link>
          </View>
        </View>
      </View>
    </Screen>
  );
}

const createStyles = (palette: any, isRTL: boolean) =>
  StyleSheet.create({
    row: { flexDirection: "row", justifyContent: "flex-start", gap:5 },

    card: { gap: 12, },
    cardTitle: {
      color: palette.text, fontSize: 28,
      textAlign: "left"
    },
    input: {
      backgroundColor: palette.surface,
      color: palette.text,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: palette.border,
      textAlign:isRTL?'right':'left'
    },
    toggle: { position: 'absolute', alignSelf: "flex-end", top: 12, right: isRTL?undefined:10,left:isRTL?10:undefined },
    link: { color: palette.accent },
    error: { color: "#f87171" },
  });
