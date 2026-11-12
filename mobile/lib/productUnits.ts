export type ProductUnit = "piece" | "g" | "ml";
export type UnitProduct = { unit?: ProductUnit; unitLabel?: string };
export const quantityStep = (product: UnitProduct) => product.unit === "g" || product.unit === "ml" ? 100 : 1;
export const unitLabel = (product: UnitProduct, ar = false, large = false) => product.unit === "g" ? (large ? (ar ? "كغ" : "Kg") : (ar ? "غ" : "g")) : product.unit === "ml" ? (large ? (ar ? "ل" : "L") : (ar ? "مل" : "ml")) : "";
export const quantityDisplayScale = (quantity: number, product: UnitProduct) => (product.unit === "g" || product.unit === "ml") && quantity >= 1000 ? 1000 : 1;
export const formatQuantity = (quantity: number, product: UnitProduct, ar = false) => {
  const scale = quantityDisplayScale(quantity, product);
  return `${quantity / scale} ${unitLabel(product, ar, scale === 1000)}`.trim();
};
export const priceBasis = (product: UnitProduct, ar = false) => unitLabel(product, ar) ? `${quantityStep(product)} ${unitLabel(product, ar)}` : "";
export const roundAmount = (value: number) => Math.round((value + Number.EPSILON) * 1e8) / 1e8;
