import { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  image?: string;
  quantity: number;
}

interface CartContextValue {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  setQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  reload: () => Promise<void>;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>([]);

  const loadFromStorage = async () => {
    const val = await AsyncStorage.getItem("cart");
    if (val) {
      setItems(JSON.parse(val));
    } else {
      setItems([]);
    }
  };

  useEffect(() => {
    loadFromStorage();
  }, []);

  const persist = (next: CartItem[]) => {
    setItems(next);
    AsyncStorage.setItem("cart", JSON.stringify(next));
  };

  const addItem = (item: CartItem) => {
    const existing = items.find((i) => i.productId === item.productId);
    if (existing) {
      const next = items.map((i) => (i.productId === item.productId ? { ...i, quantity: i.quantity + item.quantity } : i));
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
  const clear = () => persist([]);

  return <CartContext.Provider value={{ items, addItem, setQuantity, removeItem, clear, reload: loadFromStorage }}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
};
