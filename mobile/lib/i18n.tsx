import { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

type Lang = "en" | "ar";

const I18N_STORAGE_KEY = "app-language";

const baseStrings = {
  store: "Store",
  cart: "Cart",
  orders: "Orders",
  profile: "Profile",
  checkout: "Checkout",
  membership: "Membership",
  wallet: "Wallet",
  settings: "Settings",
  addToCart: "Add to cart",
  placeOrder: "Place order",
  login: "Login",
  register: "Create account",
  forgotPassword: "Reset password",
  email: "Email",
  password: "Password",
  name: "Full name",
  continue: "Continue",
  backToLogin: "Back to login",
  pushNotifications: "Push notifications",
  language: "Language",
  theme: "Theme",
  system: "System",
  light: "Light",
  dark: "Dark",
  usePoints: "Use points reward",
  yes: "Yes",
  no: "No",
  distance: "Distance",
  deliveryFee: "Delivery fee",
  total: "Total",
  storeLocation: "Store location",
  orderHistory: "Order history",
  helloShopper: "Hello shopper",
  hello: "Hello",
  deliveryTo: "Delivery to",
  loginToLoadLocation: "No selected address.",
  featuredCategories: "Featured categories",
  freshPicks: "Fresh picks",
  amount: "Amount",
  submit: "Submit request",
  rewards: "Points",
  redeemAvailable: "Reward available",
  balance: "Balance",
  searchProducts: "Search products",
  shopTagline: "Discover fresh picks in your language & theme",
  shopByCategory: "Shop by category",
  noDescription: "No description",
  products: "Products",
  emptyProducts: "No products found",
  searching: "Searching...",
  subtotal: "Subtotal",
  clearCart: "Clear cart",
  order: "Order",
  status: "Status",
  timeline: "Timeline",
  items: "Items",
  pointsLeft: "points left to unlock a reward",
  earnPoints: "How to earn",
  earnPointsCopy: "Earn points on subtotal after delivery.",
  pointsBalance: "Points balance",
  pointEarnRate: "1 point per {amount} SYP on subtotal.",
  viewPoints: "View points",
  usePointsTitle: "How to use",
  usePointsCopy: "Apply reward during checkout for one order.",
  topUpRequest: "Top-up request",
  registerFailed: "Could not register",
  invalidCredentials: "Invalid credentials",
  loginHeadline: "Grocery on the go.",
  loginSubhead: "Earn points, track orders, and level up your membership.",
  sendLink: "Send link",
  resetCopy: "We will send a recovery link to your email.",
  resetSent: "If this email exists, a link was sent.",
  guest: "Guest",
  role: "Role",
  logout: "Logout",
  address: "Address",
  phone: "Phone",
  latitude: "Latitude",
  longitude: "Longitude",
  level: "Level",
  remainingToNext: "Remaining to ",
  graceDays: "Grace days",
  benefits: "Benefits",
  priorityDelivery: "Priority delivery",
  loyalOffers: "Extra offers for loyal members",
  congrats: "Congrats!",
  leveledUp: "You just leveled up.",
  loginToSeeOrders: "Please login to view your orders.",
  filters: "Filters",
  clear: "Clear",
  sortBy: "Sort by",
  relevance: "Relevance",
  priceLowHigh: "Price: Low to High",
  priceHighLow: "Price: High to Low",
  price: "Price",
  all: "All",
  under50k: "Under 50K",
  under100k: "Under 100K",
  over100k: "100K +",
  apply: "Apply",
  remove: "Remove",
  loginToSeeProfile: "Please login to view your profile.",
  confirmRemove: "Remove item?",
  confirmRemoveCopy: "Are you sure you want to remove this item from your cart?",
  dontAskAgain: "Don't ask again",
  emptyCartTitle: "Your cart is empty",
  emptyCartCopy: "Add items to your cart to see them here.",
  startBrowsing: "Start browsing",
  confirmClearCart: "Clear cart?",
  confirmClearCartCopy: "This will remove all items from your cart.",
  back: "Back",
  viewAll: "View all",
  tapToSetLocation: "Enter coordinates to set location",
  loginToCheckout: "Login to checkout",
  savedAddresses: "Saved addresses",
  addAddress: "Add address",
  editAddress: "Edit address",
  guestInfo: "Guest information",
  fillGuestForm: "Fill the form below or login.",
  loginOrGuest: "Login or checkout as guest",
  chooseAddress: "Choose address",
  noAddresses: "No addresses saved yet.",
  label: "Label",
  save: "Save",
  cancel: "Cancel",
  delete: "Delete",
  edit: "Edit",
  useCurrentLocation: "Use current location",
  show: "Show",
  hide: "Hide",
};

const messages: Record<Lang, Record<string, string>> = {
  en: { ...baseStrings },
  ar: { ...baseStrings },
};

interface I18nContextValue {
  lang: Lang;
  t: (key: string) => string;
  setLang: (lang: Lang) => void;
  isRTL: boolean;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

const detectDeviceLang = (): Lang => {
  const locale = (Intl.DateTimeFormat().resolvedOptions().locale || "en").toLowerCase();
  return locale.startsWith("ar") ? "ar" : "en";
};

export const I18nProvider = ({ children }: { children: React.ReactNode }) => {
  const [lang, setLangState] = useState<Lang>(detectDeviceLang());

  useEffect(() => {
    AsyncStorage.getItem(I18N_STORAGE_KEY).then((stored) => {
      if (stored === "en" || stored === "ar") setLangState(stored);
    });
  }, []);

  const setLang = (next: Lang) => {
    setLangState(next);
    AsyncStorage.setItem(I18N_STORAGE_KEY, next).catch(() => {});
  };

  const value = useMemo<I18nContextValue>(() => {
    const dict = messages[lang] || messages.en;
    const t = (key: string) => dict[key] ?? messages.en[key] ?? key;
    return { lang, t, setLang, isRTL: lang === "ar" };
  }, [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = () => {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
};
