import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Language = "en" | "ar";

const translations: Record<Language, Record<string, string>> = {
  en: {
    // navigation
    "nav.dashboard": "Dashboard",
    "nav.products": "Products",
    "nav.categories": "Categories",
    "nav.orders": "Orders",
    "nav.users": "Users",
    "nav.wallet": "Wallet Top-ups",
    "nav.settings": "Settings",
    "nav.audit": "Audit Logs",
    shopicoAdminPanel:"Shopico Admin Panel",
    logout: "Logout",
    // common
    filter: "Filter",
    clear: "Clear",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    edit: "Edit",
    view: "View",
    approve: "Approve",
    reject: "Reject",
    confirmPayment: "Confirm Payment",
    addProduct: "Add product",
    addCategory: "Add category",
    images: "Images",
    image: "Image",
    name: "Name",
    description: "Description",
    category: "Category",
    price: "Price",
    stock: "Stock",
    status: "Status",
    payment: "Payment",
    total: "Total",
    amount: "Amount",
    method: "Method",
    customer: "Customer",
    email: "Email",
    role: "Role",
    membership: "Membership",
    "role.customer": "Customer",
    "role.admin": "Admin",
    "role.staff": "Staff",
    searchName: "Search name",
    searchNameEmail: "Search name or email",
    searchUser: "Search user/email/order",
    searchTopup: "Search user/email",
    searchCategory: "Search name or description",
    upload: "Upload",
    "titles.orders": "Orders",
    "titles.wallet": "Top-up approvals",
    "titles.users": "Users",
    "titles.userDetail": "User Detail",
    "titles.settings": "Settings",
    walletBalance: "Wallet Balance",
    points: "Points",
    walletLedger: "Wallet Ledger",
    pointsLedger: "Points Ledger",
    noOrders: "No orders",
    noTopups: "No topups",
    noCategories: "No categories",
    newCategory: "New Category",
    newProduct: "New Product",
    loginTitle: "Admin Login",
    loginSubtitle: "Use the seeded admin credentials or your own account.",
    emailLabel: "Email",
    passwordLabel: "Password",
    loginButton: "Login",
    signingIn: "Signing in...",
    invalidCredentials: "Invalid credentials",
    // settings
    "settings.operational": "Operational Settings",
    "settings.membership": "Membership Settings",
    storeLat: "Store latitude",
    storeLng: "Store longitude",
    deliveryFreeKm: "Free delivery distance (Km)",
    deliveryRatePerKm: "Delivery rate per Km (SYP)",
    membershipGraceDays: "Membership grace days",
    levelsLabel: "Levels (SYP)",
    "level.silver": "Silver",
    "level.gold": "Gold",
    "level.platinum": "Platinum",
    "level.diamond": "Diamond",
    pointsPerAmount: "Point cost (SYP per point)",
    rewardThresholdPoints: "Reward threshold (points)",
    rewardValue: "Reward value (SYP)",
    saveSettings: "Save Settings",
    loadingSettings: "Loading settings...",
  },
  ar: {
    // navigation
    "nav.dashboard": "لوحة التحكم",
    "nav.products": "المنتجات",
    "nav.categories": "التصنيفات",
    "nav.orders": "الطلبات",
    "nav.users": "المستخدمون",
    "nav.wallet": "طلبات الشحن",
    "nav.settings": "الإعدادات",
    "nav.audit": "سجل التدقيق",
    shopicoAdminPanel:"لوحة إدارة شوبيكو",
    logout: "تسجيل الخروج",
    // common
    filter: "تصفية",
    clear: "مسح",
    save: "حفظ",
    cancel: "إلغاء",
    delete: "حذف",
    edit: "تعديل",
    view: "عرض",
    approve: "موافقة",
    reject: "رفض",
    confirmPayment: "تأكيد الدفع",
    addProduct: "إضافة منتج",
    addCategory: "إضافة تصنيف",
    images: "الصور",
    image: "صورة",
    name: "الإسم",
    description: "الوصف",
    category: "التصنيف",
    price: "السعر",
    stock: "المخزون",
    status: "الحالة",
    payment: "الدفع",
    total: "الإجمالي",
    amount: "المبلغ",
    method: "الطريقة",
    customer: "العميل",
    email: "البريد الإلكتروني",
    role: "الدور",
    membership: "العضوية",
    "role.customer": "عميل",
    "role.admin": "مسؤول",
    "role.staff": "موظف",
    searchName: "ابحث بالإسم",
    searchNameEmail: "ابحث بالإسم أو البريد",
    searchUser: "ابحث عن المستخدم/البريد/الطلب",
    searchTopup: "ابحث عن المستخدم أو البريد",
    searchCategory: "ابحث بالإسم أو الوصف",
    upload: "رفع",
    "titles.orders": "الطلبات",
    "titles.wallet": "طلبات الشحن",
    "titles.users": "المستخدمون",
    "titles.userDetail": "تفاصيل المستخدم",
    "titles.settings": "الإعدادات",
    walletBalance: "رصيد المحفظة",
    points: "النقاط",
    walletLedger: "حركات المحفظة",
    pointsLedger: "حركات النقاط",
    noOrders: "لا يوجد طلبات",
    noTopups: "لا يوجد طلبات شحن",
    noCategories: "لا يوجد تصنيفات",
    newCategory: "إضافة تصنيف جديد",
    newProduct: "إضافة منتج جديد",
    loginTitle: "تسجيل الدخول للوحة التحكم",
    loginSubtitle: "استخدم بيانات المسؤول الافتراضية أو حسابك.",
    emailLabel: "البريد الإلكتروني",
    passwordLabel: "كلمة المرور",
    loginButton: "دخول",
    signingIn: "جاري الدخول...",
    invalidCredentials: "بيانات غير صحيحة",
    // settings
    "settings.operational": "إعدادات التشغيل",
    "settings.membership": "إعدادات العضوية",
    storeLat: "خط العرض للمتجر",
    storeLng: "خط الطول للمتجر",
    deliveryFreeKm: "مسافة التوصيل المجاني (كم)",
    deliveryRatePerKm: "تكلفة التوصيل لكل كم (ل.س)",
    membershipGraceDays: "أيام السماح للعضوية",
    levelsLabel: "مستويات العضوية (ل.س)",
    "level.silver": "فضي",
    "level.gold": "ذهبي",
    "level.platinum": "بلاتيني",
    "level.diamond": "ماسي",
    pointsPerAmount: "تكلفة النقطة (ل.س لكل نقطة)",
    rewardThresholdPoints: "عتبة المكافأة (نقاط)",
    rewardValue: "قيمة المكافأة (ل.س)",
    saveSettings: "حفظ الإعدادات",
    loadingSettings: "جار تحميل الإعدادات...",
  },
};

const statusTranslations: Record<string, { en: string; ar: string }> = {
  PENDING: { en: "Pending", ar: "قيد الانتظار" },
  PROCESSING: { en: "Processing", ar: "قيد المعالجة" },
  SHIPPING: { en: "Shipping", ar: "قيد الشحن" },
  DELIVERED: { en: "Delivered", ar: "تم التوصيل" },
  CANCELLED: { en: "Cancelled", ar: "ملغي" },
  APPROVED: { en: "Approved", ar: "مقبول" },
  REJECTED: { en: "Rejected", ar: "مرفوض" },
  CONFIRMED: { en: "Confirmed", ar: "مؤكد" },
};

interface I18nContextValue {
  lang: Language;
  dir: "ltr" | "rtl";
  t: (key: string) => string;
  tStatus: (key: string) => string;
  toggleLanguage: () => void;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLang] = useState<Language>((localStorage.getItem("lang") as Language) || "en");
  const dir: "ltr" | "rtl" = lang === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    document.documentElement.setAttribute("dir", dir);
    document.documentElement.setAttribute("lang", lang);
    localStorage.setItem("lang", lang);
  }, [lang, dir]);

  const t = (key: string) => translations[lang][key] || translations.en[key] || key;
  const tStatus = (key: string) => statusTranslations[key]?.[lang] || key;
  const toggleLanguage = () => setLang((prev) => (prev === "en" ? "ar" : "en"));

  return <I18nContext.Provider value={{ lang, dir, t, tStatus, toggleLanguage }}>{children}</I18nContext.Provider>;
};

export const useI18n = () => {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
};
