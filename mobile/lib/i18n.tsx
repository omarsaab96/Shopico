import { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

type Lang = "en" | "ar";

const I18N_STORAGE_KEY = "app-language";

const messages: Record<Lang, Record<string, string>> = {
  en: {
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
    earnPointsCopy: "1 point per 10,000 SYP on subtotal after delivery.",
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
    latitude: "Latitude",
    longitude: "Longitude",
    level: "Level",
    remainingToNext: "Remaining to next level",
    graceDays: "Grace days",
    benefits: "Benefits",
    priorityDelivery: "Priority delivery",
    loyalOffers: "Extra offers for loyal members",
    congrats: "Congrats!",
    leveledUp: "You just leveled up.",
  },
  ar: {
    store: "المتجر",
    cart: "السلة",
    orders: "الطلبات",
    profile: "الملف الشخصي",
    checkout: "إتمام الطلب",
    membership: "العضوية",
    wallet: "المحفظة",
    settings: "الإعدادات",
    addToCart: "أضف إلى السلة",
    placeOrder: "تأكيد الطلب",
    login: "تسجيل الدخول",
    register: "إنشاء حساب",
    forgotPassword: "استعادة كلمة المرور",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    name: "الاسم الكامل",
    continue: "متابعة",
    backToLogin: "العودة لتسجيل الدخول",
    pushNotifications: "إشعارات الدفع",
    language: "اللغة",
    theme: "السمة",
    system: "النظام",
    light: "فاتح",
    dark: "داكن",
    usePoints: "استخدم نقاط المكافأة",
    yes: "نعم",
    no: "لا",
    distance: "المسافة",
    deliveryFee: "رسوم التوصيل",
    total: "الإجمالي",
    storeLocation: "موقع المتجر",
    orderHistory: "سجل الطلبات",
    helloShopper: "أهلاً بالمتسوق",
    featuredCategories: "فئات مميزة",
    freshPicks: "اختيارات طازجة",
    amount: "المبلغ",
    submit: "إرسال الطلب",
    rewards: "النقاط",
    redeemAvailable: "مكافأة متاحة",
    balance: "الرصيد",
    searchProducts: "ابحث عن المنتجات",
    shopTagline: "اكتشف المنتجات بواجهة تناسبك",
    shopByCategory: "تسوق حسب الفئة",
    noDescription: "لا يوجد وصف",
    products: "المنتجات",
    emptyProducts: "لا يوجد منتجات",
    searching: "جاري البحث...",
    subtotal: "الإجمالي الفرعي",
    clearCart: "إفراغ السلة",
    order: "طلب",
    status: "الحالة",
    timeline: "المخطط الزمني",
    items: "العناصر",
    pointsLeft: "نقاط متبقية للحصول على مكافأة",
    earnPoints: "كيفية كسب النقاط",
    earnPointsCopy: "نقطة لكل 10,000 ل.س من المجموع بعد التوصيل.",
    usePointsTitle: "كيفية الاستخدام",
    usePointsCopy: "طبّق المكافأة أثناء الدفع لطلب واحد.",
    topUpRequest: "طلب شحن",
    registerFailed: "تعذر إنشاء الحساب",
    invalidCredentials: "بيانات غير صحيحة",
    loginHeadline: "تسوّق سريع من هاتفك",
    loginSubhead: "اكسب نقاطاً وتتبع الطلبات وارتقِ بعضويتك.",
    sendLink: "إرسال الرابط",
    resetCopy: "سنرسل رابط استعادة إلى بريدك.",
    resetSent: "إذا كان البريد مسجلاً تم إرسال الرابط.",
    guest: "ضيف",
    role: "الدور",
    logout: "تسجيل الخروج",
    address: "العنوان",
    latitude: "خط العرض",
    longitude: "خط الطول",
    level: "المستوى",
    remainingToNext: "متبقي للوصول للمستوى التالي",
    graceDays: "أيام السماح",
    benefits: "المزايا",
    priorityDelivery: "توصيل ذو أولوية",
    loyalOffers: "عروض إضافية للأعضاء",
    congrats: "تهانينا!",
    leveledUp: "لقد انتقلت إلى مستوى أعلى.",
  },
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
