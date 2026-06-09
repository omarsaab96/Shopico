import { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "./api";
import { useAuth } from "./auth";

export interface CartItem {
  productId: string;
  variantId?: string;
  variantAttributes?: Record<string, string>;
  name: string;
  price: number;
  image?: string;
  quantity: number;
  unavailable?: boolean;
}

interface CartContextValue {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  replaceItems: (items: CartItem[]) => void;
  setQuantity: (productId: string, quantity: number, variantId?: string) => void;
  removeItem: (productId: string, variantId?: string) => void;
  reload: () => Promise<void>;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);

  const storageKey = user?._id ? `cart:${user._id}` : "cart:guest";
  const getCartKey = (item: Pick<CartItem, "productId" | "variantId">) => `${item.productId}:${item.variantId || ""}`;

  const serializeCartItem = (item: any): CartItem | null => {
    const product = item.product || {};
    const productId = item.productId || product._id || item.product;
    if (!productId) return null;
    return {
      productId: productId.toString(),
      variantId: item.variantId?.toString(),
      variantAttributes: item.variantAttributes,
      name: item.name || product.name || "",
      price: Number(item.price ?? item.priceSnapshot ?? product.promoPrice ?? product.price ?? 0),
      image: item.image || product.images?.[0]?.url,
      quantity: Number(item.quantity || 1),
      unavailable: item.unavailable,
    };
  };

  const loadFromStorage = async (key = storageKey) => {
    const val = await AsyncStorage.getItem(key);
    if (val) {
      setItems(JSON.parse(val));
    } else {
      setItems([]);
    }
  };

  const loadUserCartFromServer = async (userId: string) => {
    const res = await api.get("/cart");
    const rawItems = res.data.data?.items || [];
    const next = rawItems.map(serializeCartItem).filter(Boolean) as CartItem[];
    setItems(next);
    await AsyncStorage.setItem(`cart:${userId}`, JSON.stringify(next));
  };

  useEffect(() => {
    let cancelled = false;

    const loadCart = async () => {
      if (!user?._id) {
        if (!cancelled) setItems([]);
        return;
      }

      try {
        if (cancelled) return;
        await loadUserCartFromServer(user._id);
      } catch {
        if (!cancelled) setItems([]);
      }
    };

    loadCart();
    return () => {
      cancelled = true;
    };
  }, [user?._id]);

  const persist = (next: CartItem[]) => {
    setItems(next);
    AsyncStorage.setItem(storageKey, JSON.stringify(next));
    if (user?._id) {
      api
        .put("/cart", {
          items: next
            .filter((item) => !item.unavailable)
            .map((item) => ({ productId: item.productId, variantId: item.variantId, quantity: item.quantity })),
        })
        .catch(() => { });
    }
  };

  const addItem = (item: CartItem) => {
    const itemKey = getCartKey(item);
    const existing = items.find((i) => getCartKey(i) === itemKey);
    if (existing) {
      const next = items.map((i) => (getCartKey(i) === itemKey ? { ...item, quantity: i.unavailable ? item.quantity : i.quantity + item.quantity } : i));
      return persist(next);
    }
    persist([...items, item]);
  };

  const setQuantity = (productId: string, quantity: number, variantId?: string) => {
    if (quantity <= 0) return removeItem(productId, variantId);
    const key = `${productId}:${variantId || ""}`;
    const exists = items.some((i) => getCartKey(i) === key);
    if (!exists) return;
    const next = items.map((i) => (getCartKey(i) === key ? { ...i, quantity } : i));
    persist(next);
  };

  const removeItem = (productId: string, variantId?: string) => {
    const key = `${productId}:${variantId || ""}`;
    persist(items.filter((i) => getCartKey(i) !== key));
  };
  const replaceItems = (next: CartItem[]) => persist(next);
  const clear = () => persist([]);

  const reload = async () => {
    if (user?._id) {
      await loadUserCartFromServer(user._id);
    } else {
      await loadFromStorage();
    }
  };

  return <CartContext.Provider value={{ items, addItem, replaceItems, setQuantity, removeItem, clear, reload }}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
};
