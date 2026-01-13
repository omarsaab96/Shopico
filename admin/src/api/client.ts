import axios from "axios";
import type { ApiUser, Category, Product, Order, WalletTopUp, Settings, Announcement, Coupon } from "../types/api";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || "http://localhost:4000/api",
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface AuthResponse {
  user: ApiUser;
  accessToken: string;
  refreshToken: string;
}

export const login = async (email: string, password: string) => {
  const res = await api.post<{ data: AuthResponse }>("/auth/login", { email, password });
  return res.data.data;
};

export const fetchProfile = async () => {
  const res = await api.get<{ data: { user: ApiUser } }>("/auth/me");
  return res.data.data.user;
};

export const fetchCategories = async (params?: { q?: string }) => {
  const res = await api.get<{ data: Category[] }>("/categories", { params });
  return res.data.data;
};

export const fetchProducts = async (params?: { q?: string; category?: string; includeUnavailable?: boolean }) => {
  const res = await api.get<{ data: Product[] }>("/products", {
    params: {
      ...params,
      includeUnavailable: params?.includeUnavailable ? "true" : undefined,
    },
  });
  return res.data.data;
};

export const saveProduct = async (payload: Partial<Product>) => {
  if (payload._id) {
    const res = await api.put<{ data: Product }>(`/products/${payload._id}`, payload);
    return res.data.data;
  }
  const res = await api.post<{ data: Product }>("/products", payload);
  return res.data.data;
};

export const deleteProduct = async (id: string) => api.delete(`/products/${id}`);

export const bulkUpdateProductPrices = async (payload: {
  mode: "INCREASE" | "DISCOUNT";
  amountType: "FIXED" | "PERCENT";
  amount: number;
}) => {
  const res = await api.post<{ data: { modifiedCount: number } }>("/products/bulk-price", payload);
  return res.data.data;
};

export const fetchOrders = async (params?: { q?: string; status?: string; paymentStatus?: string }) => {
  const res = await api.get<{ data: Order[] }>("/orders/admin", { params });
  return res.data.data;
};

export const updateOrderStatus = async (id: string, status: string, paymentStatus?: string) => {
  const res = await api.put<{ data: Order }>(`/orders/${id}/status`, { status, paymentStatus });
  return res.data.data;
};

export const fetchTopUps = async (params?: { status?: string; method?: string; q?: string }) => {
  const res = await api.get<{ data: WalletTopUp[] }>("/wallet/topups/admin", { params });
  return res.data.data;
};

export const updateTopUp = async (id: string, status: string, adminNote?: string) => {
  const res = await api.put<{ data: WalletTopUp }>(`/wallet/topups/${id}`, { status, adminNote });
  return res.data.data;
};

export const adminTopUpUser = async (userId: string, amount: number, note?: string) => {
  const res = await api.post<{ data: { wallet: { balance: number } } }>("/wallet/topups/admin/manual", {
    userId,
    amount,
    note,
  });
  return res.data.data;
};

export const fetchSettings = async () => {
  const res = await api.get<{ data: Settings }>("/settings");
  return res.data.data;
};

export const updateSettings = async (payload: Partial<Settings>) => {
  const res = await api.put<{ data: Settings }>("/settings", payload);
  return res.data.data;
};

export const getImageKitAuth = async () => {
  const res = await api.get<{ data: { token: string; expire: number; signature: string; publicKey: string } }>(
    "/uploads/imagekit-auth"
  );
  return res.data.data;
};

export const fetchAnnouncements = async (params?: { q?: string; from?: string; to?: string }) => {
  const res = await api.get<{ data: Announcement[] }>("/announcements", { params });
  return res.data.data;
};

export const saveAnnouncement = async (payload: Partial<Announcement>) => {
  if (payload._id) {
    const res = await api.put<{ data: Announcement }>(`/announcements/${payload._id}`, payload);
    return res.data.data;
  }
  const res = await api.post<{ data: Announcement }>("/announcements", payload);
  return res.data.data;
};

export const deleteAnnouncement = async (id: string) => api.delete(`/announcements/${id}`);


export const fetchCoupons = async (params?: {
  q?: string;
  consumed?: boolean;
  enabled?: boolean;
  expiresFrom?: string;
  expiresTo?: string;
}) => {
  const res = await api.get<{ data: Coupon[] }>("/coupons", {
    params: {
      ...params,
      consumed: params?.consumed === undefined ? undefined : String(params.consumed),
      enabled: params?.enabled === undefined ? undefined : String(params.enabled),
    },
  });
  return res.data.data;
};

export const saveCoupon = async (payload: Partial<Coupon>) => {
  if (payload._id) {
    const res = await api.put<{ data: Coupon }>(`/coupons/${payload._id}`, payload);
    return res.data.data;
  }
  const res = await api.post<{ data: Coupon }>("/coupons", payload);
  return res.data.data;
};

export const deleteCoupon = async (id: string) => api.delete(`/coupons/${id}`);

export default api;
