import React, { forwardRef } from "react";
import {
  Text as RNText,
  TextProps as RNTextProps,
  TextStyle,
  StyleSheet,
} from "react-native";
import { useI18n } from "../lib/i18n";
import { FontWeight, resolveFont } from "../lib/typography";

export interface TextProps extends RNTextProps {
  weight?: FontWeight;
}

const normalizeWeight = (weight?: TextStyle["fontWeight"]): FontWeight => {
  if (weight === undefined || weight === "normal") return "regular";
  if (weight === "bold") return "bold";
  const numeric = typeof weight === "string" ? parseInt(weight, 10) : weight;
  if (!numeric) return "regular";
  if (numeric >= 900) return "black";
  if (numeric >= 700) return "bold";
  if (numeric >= 600) return "semibold";
  if (numeric >= 500) return "medium";
  return "regular";
};

const Text = forwardRef<RNText, TextProps>(({ style, weight, ...rest }, ref) => {
  const { isRTL } = useI18n();
  const flattened = StyleSheet.flatten(style) as TextStyle | undefined;
  const effectiveWeight = weight ?? normalizeWeight(flattened?.fontWeight);
  const baseStyle: TextStyle = { fontFamily: resolveFont(isRTL, effectiveWeight) };
  const cleanedStyle = flattened ? { ...flattened, fontWeight: undefined } : undefined;
  const resolvedStyle = StyleSheet.flatten([cleanedStyle, baseStyle]);

  return <RNText ref={ref} {...rest} style={resolvedStyle} />;
});

Text.displayName = "Text";

export default Text;
