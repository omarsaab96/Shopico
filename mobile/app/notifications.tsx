import { useCallback } from "react";
import { ActivityIndicator, Alert, FlatList, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import Screen from "../components/Screen";
import Text from "../components/Text";
import { useTheme } from "../lib/theme";
import { useI18n } from "../lib/i18n";
import { useNotifications } from "../lib/notifications";
import { useAuth } from "../lib/auth";
import Feather from "@expo/vector-icons/Feather";

export default function NotificationsScreen() {
  const { items, unreadCount, loading, error, refresh, loadMore, hasMore, open, readAll } = useNotifications();
  const { palette } = useTheme();
  const { lang } = useI18n();
  const { user } = useAuth();
  const router = useRouter();
  const ar = lang === "ar";
  const { t, isRTL } = useI18n();

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  const failed = () => Alert.alert(ar ? "تعذر التحديث" : "Could not update notification", ar ? "حاول مجدداً." : "Please retry.");
  return <Screen>
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>

      <View style={{ flexDirection:  "row", alignItems: "center", gap: 10 }}>
        <TouchableOpacity
          style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: palette.card, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: palette.border }}
          accessibilityRole="button"
          accessibilityLabel={ar ? "????" : "Back"}
          onPress={() => router.canGoBack() ? router.back() : router.replace("/home")}
          activeOpacity={0.85}>
          <Feather name={isRTL ? "arrow-right" : "arrow-left"} size={21} color={palette.text} />
        </TouchableOpacity>

          <Text weight="bold" style={{
            color: palette.text,
            fontSize: 22,
            lineHeight: 22,
            textAlign: "center",
          }}>
            {ar ? "الإشعارات" : "Notifications"}
          </Text>
      </View>

      {/* <TouchableOpacity onPress={() => router.push("/settings")} accessibilityLabel={ar ? "إعدادات الإشعارات" : "Notification settings"}>
        <Text style={{ color: palette.accent }}>{ar ? "الإعدادات" : "Settings"}</Text>
      </TouchableOpacity> */}
      {unreadCount > 0 && <TouchableOpacity accessibilityRole="button" onPress={() => void readAll().catch(failed)} activeOpacity={0.85} style={{  }}>
        <Text style={{ color: palette.accent, fontWeight: "900", textAlign: "left" }}>
          {ar ? "قراءة الكل" : "Mark all as read"} ({unreadCount})
        </Text>
      </TouchableOpacity>}
    </View>

    {!user ? <TouchableOpacity onPress={() => router.push("/auth/login")}><Text>{ar ? "سجّل الدخول لعرض الإشعارات" : "Sign in to view notifications"}</Text></TouchableOpacity> : <>

      {error ?
        <TouchableOpacity onPress={() => void refresh()}>
          <Text style={{ color: palette.accent }}>{error}</Text>
        </TouchableOpacity>
        : null
      }
      <FlatList
        data={items}
        keyExtractor={item => item._id}
        refreshing={loading}
        onRefresh={() => void refresh()}
        contentContainerStyle={{ gap: 0, paddingBottom: 30 }}
        ListEmptyComponent={loading ? <ActivityIndicator color={palette.accent} /> : <Text style={{ color: palette.muted, marginTop: 30 }}>{ar ? "لا توجد إشعارات بعد" : "No notifications yet"}</Text>}
        renderItem={({ item }) => {
          return (
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => void open(item).catch(failed)}
              style={[{
                // backgroundColor: palette.card,
                borderRadius: 0,
                borderBottomWidth: 1,
                borderColor: palette.border,
                padding: 5,
              },
              item.readAt && { opacity: 0.7 }
              ]
              }
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  {!item.readAt && <View style={{ width: 8, height: 8, backgroundColor: palette.accent, borderRadius: 5 }} />}
                  <Text style={{ color: palette.text, fontWeight: item.readAt ? "500" : "800" }}>
                    {item.title[ar ? "ar" : "en"]}
                  </Text>
                </View>

                <Text style={{ color: palette.muted, fontSize: 11 }}>
                  {new Date(item.createdAt).toLocaleString(ar ? "ar" : "en")}
                </Text>
              </View>

              <Text style={{ color: palette.muted }}>
                {item.body[ar ? "ar" : "en"]}
              </Text>
            </TouchableOpacity>
          );
        }}
        ListFooterComponent={hasMore ?
          <TouchableOpacity
            style={{ padding: 16 }}
            onPress={() => void loadMore()}>
            <Text style={{ color: palette.accent }}>
              {ar ? "المزيد" : "Load more"}
            </Text>
          </TouchableOpacity>
          : null} />
    </>}
  </Screen>;
}
