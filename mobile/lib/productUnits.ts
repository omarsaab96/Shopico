export type ProductUnit = "piece" | "g" | "ml";
export type UnitProduct = { unit?: ProductUnit; unitLabel?: string };
export const quantityStep = (product: UnitProduct) => product.unit === "g" || product.unit === "ml" ? 100 : 1;
export const unitLabel = (product: UnitProduct, ar = false) => product.unit === "g" ? (ar ? "غ" : "g") : product.unit === "ml" ? (ar ? "مل" : "ml") : product.unitLabel || (ar ? "قطعة" : "piece");
export const formatQuantity = (quantity: number, product: UnitProduct, ar = false) => `${quantity} ${unitLabel(product, ar)}`;
export const priceBasis = (product: UnitProduct, ar = false) => `${quantityStep(product)} ${unitLabel(product, ar)}`;
export const roundAmount = (value: number) => Math.round((value + Number.EPSILON) * 1e8) / 1e8;
