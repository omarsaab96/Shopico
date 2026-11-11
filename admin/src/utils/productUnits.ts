import type { ProductUnit } from "../types/api";
export const unitLabel = (product: { unit?: ProductUnit; unitLabel?: string }, ar = false) => product.unit === "g" ? (ar ? "غ" : "g") : product.unit === "ml" ? (ar ? "مل" : "ml") : product.unitLabel || (ar ? "قطعة" : "piece");
