import { useCallback } from "react";
import { ActivityIndicator, Alert, FlatList, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import Screen from "../components/Screen";
import Text from "../components/Text";
import { useTheme } from "../lib/theme";
import { useI18n } from "../lib/i18n";
import { useNotifications } from "../lib/notifications";
import { useAuth } from "../lib/auth";

export default function NotificationsScreen() {
  const { items, unreadCount, loading, error, refresh, loadMore, hasMore, open, readAll } = useNotifications();
  const { palette } = useTheme();
  const { lang } = useI18n();
  const { user } = useAuth();
  const router = useRouter();
  const ar = lang === "ar";
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  const failed = () => Alert.alert(ar ? "تعذر التحديث" : "Could not update notification", ar ? "حاول مجدداً." : "Please retry.");
  return <Screen showBack backLabel={ar ? "رجوع" : "Back"}>
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}><Text style={{ fontSize: 24, color: palette.text, fontWeight: "700" }}>{ar ? "الإشعارات" : "Notifications"}</Text><TouchableOpacity onPress={() => router.push("/settings")} accessibilityLabel={ar ? "إعدادات الإشعارات" : "Notification settings"}><Text style={{ color: palette.accent }}>{ar ? "الإعدادات" : "Settings"}</Text></TouchableOpacity></View>
    {!user ? <TouchableOpacity onPress={() => router.push("/auth/login")}><Text>{ar ? "سجّل الدخول لعرض الإشعارات" : "Sign in to view notifications"}</Text></TouchableOpacity> : <>
      <TouchableOpacity disabled={!unreadCount} onPress={() => void readAll().catch(failed)} style={{ paddingVertical: 12 }}><Text style={{ color: unreadCount ? palette.accent : palette.muted }}>{ar ? "قراءة الكل" : "Mark all as read"} ({unreadCount})</Text></TouchableOpacity>
      {error ? <TouchableOpacity onPress={() => void refresh()}><Text style={{ color: palette.accent }}>{error}</Text></TouchableOpacity> : null}
      <FlatList data={items} keyExtractor={item => item._id} refreshing={loading} onRefresh={() => void refresh()} contentContainerStyle={{ gap: 10, paddingBottom: 30 }} ListEmptyComponent={loading ? <ActivityIndicator color={palette.accent} /> : <Text style={{ color: palette.muted, marginTop: 30 }}>{ar ? "لا توجد إشعارات بعد" : "No notifications yet"}</Text>} renderItem={({ item }) => <TouchableOpacity accessibilityRole="button" onPress={() => void open(item).catch(failed)} style={{ backgroundColor: palette.card, borderRadius: 14, borderWidth: 1, borderColor: item.readAt ? palette.border : palette.accent, padding: 16, gap: 8 }}><Text style={{ color: palette.text, fontWeight: item.readAt ? "500" : "800" }}>{item.title[ar ? "ar" : "en"]}</Text><Text style={{ color: palette.text }}>{item.body[ar ? "ar" : "en"]}</Text><Text style={{ color: palette.muted, fontSize: 11 }}>{new Date(item.createdAt).toLocaleString(ar ? "ar" : "en")}</Text></TouchableOpacity>} ListFooterComponent={hasMore ? <TouchableOpacity style={{ padding: 16 }} onPress={() => void loadMore()}><Text style={{ color: palette.accent }}>{ar ? "المزيد" : "Load more"}</Text></TouchableOpacity> : null} />
    </>}
  </Screen>;
}
