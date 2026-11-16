import { useRouter } from "expo-router";
import ActiveOrderCard from "./ActiveOrderCard";
import type { OrderPreview } from "../lib/orderPreview";
import { useI18n } from "../lib/i18n";

export type ActiveDriverDelivery = OrderPreview & { address?: string };

export default function ActiveDriverDeliveryBanner({ order, currentOrderId }: {
  order?: ActiveDriverDelivery | null; currentOrderId?: string;
}) {
  const router = useRouter();
  const { t } = useI18n();
  if (!order || order.status !== "SHIPPING") return null;
  const current = order._id === currentOrderId;
  return (
    <ActiveOrderCard order={order} statusLabel={t("driverDeliveryInProgress")}
      onPress={current ? undefined : () => router.push(`/driver-orders/${order._id}` as any)} />
  );
}
