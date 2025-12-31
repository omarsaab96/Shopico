export type UserRole = "customer" | "admin" | "staff";

export interface ApiUser {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  membershipLevel?: string;
  points?: number;
}

export interface Category {
  _id: string;
  name: string;
  description?: string;
  imageUrl?: string | null;
}

export interface ProductImage {
  url: string;
  fileId: string;
}

export interface Product {
  _id: string;
  name: string;
  description?: string;
  price: number;
  stock: number;
  images: ProductImage[];
  category: Category | string;
}

export interface OrderItem {
  product: Product | string;
  quantity: number;
  price: number;
}

export interface Order {
  _id: string;
  user: ApiUser | string;
  items: OrderItem[];
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  address: string;
  deliveryDistanceKm: number;
  createdAt: string;
}

export interface WalletTopUp {
  _id: string;
  user: ApiUser | string;
  amount: number;
  method: string;
  status: string;
  note?: string;
  adminNote?: string;
  createdAt: string;
}

export interface Settings {
  _id: string;
  storeLat: number;
  storeLng: number;
  deliveryFreeKm: number;
  deliveryRatePerKm: number;
  membershipGraceDays: number;
  membershipThresholds: { silver: number; gold: number; platinum: number; diamond: number };
  pointsPerAmount: number;
  rewardThresholdPoints: number;
  rewardValue: number;
}
