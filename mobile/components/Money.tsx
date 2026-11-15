import { StyleSheet } from "react-native";
import type { StyleProp, TextStyle } from "react-native";
import Text from "./Text";
import type { TextProps } from "./Text";
import { useCurrency } from "../lib/currency";
import type { Currency } from "../lib/currency";

export type MoneyProps = Omit<TextProps, "children"> & {
  amount: number;
  currency?: Currency;
  currencyScale?: number;
  currencyStyle?: StyleProp<TextStyle>;
};

export default function Money({
  amount,
  currency,
  currencyScale = 0.7,
  currencyStyle,
  style,
  weight,
  ...props
}: MoneyProps) {
  const { convertFromPrimary, getCurrencySymbol } = useCurrency();
  const flattened = StyleSheet.flatten(style);
  const fontSize = flattened?.fontSize ?? 16;

  return (
    <Text {...props} weight={weight} style={[{ fontSize }, style]}>
      {convertFromPrimary(amount, currency).toLocaleString(undefined, {
        maximumFractionDigits: 2,
      })}
      {" "}
      <Text
        weight={weight}
        style={[
          { fontWeight: flattened?.fontWeight, fontSize: fontSize * currencyScale },
          currencyStyle,
        ]}
      >
        {getCurrencySymbol(currency)}
      </Text>
    </Text>
  );
}
