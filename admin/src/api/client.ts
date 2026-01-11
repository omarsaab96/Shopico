import axios from "axios";
import type { ApiUser, Category, Product, Order, WalletTopUp, Settings, Promotion } from "../types/api";

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

export const fetchProducts = async (params?: { q?: string; category?: string }) => {
  const res = await api.get<{ data: Product[] }>("/products", { params });
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

export const fetchPromotions = async (params?: { q?: string; from?: string; to?: string }) => {
  const res = await api.get<{ data: Promotion[] }>("/promotions", { params });
  return res.data.data;
};

export const savePromotion = async (payload: Partial<Promotion>) => {
  if (payload._id) {
    const res = await api.put<{ data: Promotion }>(`/promotions/${payload._id}`, payload);
    return res.data.data;
  }
  const res = await api.post<{ data: Promotion }>("/promotions", payload);
  return res.data.data;
};

export const deletePromotion = async (id: string) => api.delete(`/promotions/${id}`);

export default api;
