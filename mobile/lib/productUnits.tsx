import { View } from 'react-native';
import Text from "../components/Text";
import { useTheme } from "../lib/theme";

export type ProductUnit = "piece" | "g" | "ml";
export type UnitProduct = { unit?: ProductUnit; unitLabel?: string };
export const quantityStep = (product: UnitProduct) => product.unit === "g" || product.unit === "ml" ? 100 : 1;
export const unitLabel = (product: UnitProduct, ar = false, large = false) => product.unit === "g" ? (large ? (ar ? "كغ" : "Kg") : (ar ? "غ" : "g")) : product.unit === "ml" ? (large ? (ar ? "ل" : "L") : (ar ? "مل" : "ml")) : "";
export const quantityDisplayScale = (quantity: number, product: UnitProduct) => (product.unit === "g" || product.unit === "ml") && quantity >= 1000 ? 1000 : 1;
const QuantitySpans = ({ quantity, product, ar }: { quantity: number; product: UnitProduct; ar: boolean }) => {
  const { palette } = useTheme();
  const scale = quantityDisplayScale(quantity, product);
  return (
    <View style={{ flexDirection: 'row-reverse', justifyContent:'center', alignItems: 'center', gap:4}}>
      <Text weight="black" style={{ color: palette.text, fontSize: 16, textDecorationLine: "none", lineHeight: 18, paddingTop:ar?4:0}}>
        {quantity / scale}
      </Text>

      {unitLabel(product, ar, scale === 1000)!=="" &&<Text weight="black" style={{ color: palette.text, fontSize: 16, textDecorationLine: "none", lineHeight: 18 }}>
        {unitLabel(product, ar, scale === 1000)}
      </Text>}
    </View>
  );
};
export const formatQuantity = (quantity: number, product: UnitProduct, ar = false, inspans = false) => {
  const scale = quantityDisplayScale(quantity, product);
  
  if (inspans && ar) {
    return <QuantitySpans quantity={quantity} product={product} ar={ar} />;
  }
  return `${quantity / scale} ${unitLabel(product, ar, scale === 1000)}`.trim();
};
export const priceBasis = (product: UnitProduct, ar = false) => unitLabel(product, ar) ? `${quantityStep(product)} ${unitLabel(product, ar)}` : "";
export const roundAmount = (value: number) => Math.round((value + Number.EPSILON) * 1e8) / 1e8;
