export type FontWeight = "regular" | "medium" | "semibold" | "bold" | "black";
type ArabicFontFamily = "tajawal" | "noto";

// Toggle this one line to compare Arabic fonts:
const ARABIC_FONT_FAMILY: ArabicFontFamily = "tajawal";
// const ARABIC_FONT_FAMILY: ArabicFontFamily = "noto";

const latinMap: Record<FontWeight, string> = {
  regular: "Manrope_400Regular",
  medium: "Manrope_500Medium",
  semibold: "Manrope_600SemiBold",
  bold: "Manrope_700Bold",
  black: "Manrope_800ExtraBold",
};

const tajawalArabicMap: Record<FontWeight, string> = {
  regular: "Tajawal_400Regular",
  medium: "Tajawal_500Medium",
  semibold: "Tajawal_700Bold",
  bold: "Tajawal_700Bold",
  black: "Tajawal_900Black",
};

const notoArabicMap: Record<FontWeight, string> = {
  regular: "NotoSansArabic_400Regular",
  medium: "NotoSansArabic_500Medium",
  semibold: "NotoSansArabic_600SemiBold",
  bold: "NotoSansArabic_700Bold",
  black: "NotoSansArabic_900Black",
};

export const resolveFont = (isRTL: boolean, weight: FontWeight = "regular") => {
  const arabicMap = ARABIC_FONT_FAMILY === "tajawal" ? tajawalArabicMap : notoArabicMap;
  return isRTL ? arabicMap[weight] : latinMap[weight];
};
