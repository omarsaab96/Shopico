export type FontWeight = "regular" | "medium" | "semibold" | "bold" | "black";

const latinMap: Record<FontWeight, string> = {
  regular: "Manrope_400Regular",
  medium: "Manrope_500Medium",
  semibold: "Manrope_600SemiBold",
  bold: "Manrope_700Bold",
  black: "Manrope_800ExtraBold",
};

const arabicMap: Record<FontWeight, string> = {
  regular: "NotoSansArabic_400Regular",
  medium: "NotoSansArabic_500Medium",
  semibold: "NotoSansArabic_600SemiBold",
  bold: "NotoSansArabic_700Bold",
  black: "NotoSansArabic_900Black",
};

export const resolveFont = (isRTL: boolean, weight: FontWeight = "regular") => {
  return isRTL ? arabicMap[weight] : latinMap[weight];
};
