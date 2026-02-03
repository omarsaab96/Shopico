import { useEffect, useMemo, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import Screen from "../components/Screen";
import Text from "../components/Text";
import api from "../lib/api";
import { useTheme } from "../lib/theme";
import { useI18n } from "../lib/i18n";

type Address = { _id: string; label: string; address: string; lat: number; lng: number; phone?: string };

export default function AddressesWeb() {
  const { palette } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [addresses, setAddresses] = useState<Address[]>([]);

  useEffect(() => {
    api.get("/addresses").then((res) => setAddresses(res.data.data || []));
  }, []);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>{t("addresses") ?? "Addresses"}</Text>
      </View>
      <View style={styles.notice}>
        <Text style={styles.noticeText}>
          {t("mapNotSupported") ?? "Map preview is not available on web."}
        </Text>
      </View>
      <FlatList
        data={addresses}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{ gap: 10, paddingBottom: 16 }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.label || (t("address") ?? "Address")}</Text>
            <Text style={styles.cardSub}>{item.address}</Text>
            <Text style={styles.cardMeta}>
              {t("latitude") ?? "Lat"}: {item.lat} · {t("longitude") ?? "Lng"}: {item.lng}
            </Text>
          </View>
        )}
      />
    </Screen>
  );
}

const createStyles = (palette: any) =>
  StyleSheet.create({
    header: { marginBottom: 12 },
    title: { fontSize: 22, fontWeight: "900", color: palette.text },
    notice: {
      marginBottom: 12,
      padding: 12,
      borderRadius: 12,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.border,
    },
    noticeText: { color: palette.muted, fontSize: 12, fontWeight: "600" },
    card: {
      backgroundColor: palette.card,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: palette.border,
      gap: 6,
    },
    cardTitle: { color: palette.text, fontWeight: "800" },
    cardSub: { color: palette.muted },
    cardMeta: { color: palette.text, fontWeight: "600", fontSize: 12 },
  });
