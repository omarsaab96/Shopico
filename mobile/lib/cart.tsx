import { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "./api";
import { useAuth } from "./auth";

export interface CartItem {
  productId: string;
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
  setQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  reload: () => Promise<void>;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);

  const storageKey = user?._id ? `cart:${user._id}` : "cart:guest";

  const serializeCartItem = (item: any): CartItem | null => {
    const product = item.product || {};
    const productId = item.productId || product._id || item.product;
    if (!productId) return null;
    return {
      productId: productId.toString(),
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
            .map((item) => ({ productId: item.productId, quantity: item.quantity })),
        })
        .catch(() => { });
    }
  };

  const addItem = (item: CartItem) => {
    const existing = items.find((i) => i.productId === item.productId);
    if (existing) {
      const next = items.map((i) => (i.productId === item.productId ? { ...item, quantity: i.unavailable ? item.quantity : i.quantity + item.quantity } : i));
      return persist(next);
    }
    persist([...items, item]);
  };

  const setQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) return removeItem(productId);
    const exists = items.some((i) => i.productId === productId);
    if (!exists) return;
    const next = items.map((i) => (i.productId === productId ? { ...i, quantity } : i));
    persist(next);
  };

  const removeItem = (productId: string) => persist(items.filter((i) => i.productId !== productId));
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
