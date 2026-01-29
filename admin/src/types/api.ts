export type UserRole = "customer" | "admin" | "manager" | "staff";

export interface ApiUser {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  permissions?: string[];
  branchIds?: string[];
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
  promoPrice?: number;
  isPromoted?: boolean;
  isAvailable: boolean;
  images: ProductImage[];
  categories: Category[] | string[];
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
  allowMultipleCoupons: boolean;
  membershipGraceDays: number;
  membershipThresholds: { silver: number; gold: number; platinum: number; diamond: number };
  pointsPerAmount: number;
  rewardThresholdPoints: number;
  rewardValue: number;
}

export interface Branch {
  _id: string;
  name: string;
  address: string;
  phone?: string;
  lat: number;
  lng: number;
  openHours?: string;
  deliveryRadiusKm: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AnnouncementImage {
  url: string;
  fileId: string;
}

export interface Announcement {
  _id: string;
  title?: string;
  description?: string;
  link?: string;
  image?: AnnouncementImage;
  startsAt?: string;
  endsAt?: string;
  isEnabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}


export type CouponDiscountType = "PERCENT" | "FIXED";
export type CouponUsageType = "SINGLE" | "MULTIPLE";
export type CouponMaxUsesScope = "PER_USER" | "GLOBAL";

export interface Coupon {
  _id: string;
  code: string;
  title?: string;
  description?: string;
  discountType: CouponDiscountType;
  discountValue: number;
  freeDelivery: boolean;
  restricted?: boolean;
  expiresAt?: string;
  assignedUsers?: ApiUser[] | string[] | null;
  assignedProducts?: Product[] | string[] | null;
  assignedMembershipLevels?: string[] | null;
  usageType: CouponUsageType;
  maxUses?: number;
  maxUsesScope?: CouponMaxUsesScope;
  maxUsesPerUser?: number;
  maxUsesGlobal?: number;
  usedCount?: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}
