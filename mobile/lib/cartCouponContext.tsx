import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AppState, DeviceEventEmitter } from "react-native";
import api from "./api";
import { useAuth } from "./auth";
import { useCart } from "./cart";
import { useCurrency } from "./currency";
import { roundAmount } from "./productUnits";
import { closestCartCoupon, resolveCartCouponOffers } from "./cartCouponTeaser";
import { updateCartCouponState, type CartCouponState } from "./cartCouponState";

type CartCouponContextValue = CartCouponState & {
  refresh: () => void;
  hasPresented: (presentation: number) => boolean;
  markPresented: (presentation: number) => void;
};
const CartCouponContext = createContext<CartCouponContextValue | null>(null);

export function CartCouponProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { items } = useCart();
  const { selectedCurrency } = useCurrency();
  const userId = user?._id;
  const currencyId = selectedCurrency?._id;
  const scope = `${userId || ""}:${currencyId || ""}`;
  // Equal cart contents must not refetch merely because a screen reloads the cart.
  const cartKey = JSON.stringify(items.filter(item => !item.unavailable).map(item => ({
    productId: item.productId, variantId: item.variantId, unit: item.unit || "piece", quantity: item.quantity, price: item.price,
  })));
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<CartCouponState>({ scope: "", offer: null, loading: true, presentation: 0 });
  const presented = useRef(new Set<number>());
  const refresh = useCallback(() => setRevision(current => current + 1), []);
  const hasPresented = useCallback((presentation: number) => presented.current.has(presentation), []);
  const markPresented = useCallback((presentation: number) => { presented.current.add(presentation); }, []);

  useEffect(() => {
    const notification = DeviceEventEmitter.addListener("shopico:notification", refresh);
    const appState = AppState.addEventListener("change", next => { if (next === "active") refresh(); });
    return () => { notification.remove(); appState.remove(); };
  }, [refresh]);

  useEffect(() => {
    let cancelled = false;
    const cart: { productId: string; variantId?: string; unit: string; quantity: number; price: number }[] = JSON.parse(cartKey);
    if (!userId || !currencyId || !cart.length) {
      setState(previous => updateCartCouponState(previous, scope, null));
      return;
    }
    setState(previous => ({ ...previous, scope, offer: previous.scope === scope ? previous.offer : null, loading: true }));
    const timer = setTimeout(() => {
      const subtotal = roundAmount(cart.reduce((sum, item) => sum + roundAmount(item.price * item.quantity), 0));
      void Promise.all([
        api.post("/coupons/available", {
          items: cart.map(({ price, ...item }) => item), subtotal, deliveryFee: 0, currencyId,
        }),
        api.get("/points/coupons"),
      ]).then(([available, personal]) => {
        if (cancelled) return;
        const offer = closestCartCoupon(resolveCartCouponOffers(available.data.data || [], personal.data.data || [], subtotal));
        setState(previous => updateCartCouponState(previous, scope, offer));
      }).catch(() => {
        if (!cancelled) setState(previous => ({ ...previous, loading: false }));
      });
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [cartKey, userId, currencyId, scope, revision]);

  const visible = state.scope === scope ? state : { ...state, scope, offer: null, loading: true };
  return <CartCouponContext.Provider value={{ ...visible, refresh, hasPresented, markPresented }}>{children}</CartCouponContext.Provider>;
}

export function useCartCoupon() {
  const context = useContext(CartCouponContext);
  if (!context) throw new Error("useCartCoupon must be used within CartCouponProvider");
  return context;
}
