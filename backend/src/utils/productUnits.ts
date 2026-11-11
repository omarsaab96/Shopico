export type ProductUnit = "piece" | "g" | "ml";

const normalize = (value: unknown) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const countable = new Set(["piece", "pieces", "pc", "pcs", "قطعة", "حبة", "واحدة", "وحدة", "ظرف", "طقم", "كيس", "سطل", "عبوة", "علبة", "شوال", "كرتونة", "لوح", "ربطة", "رول", "دزينة", "زوج", "ماعون", "جرزة", "الواحدة 48", "الواحدة 50"]);

// Prices in Excel are per source unit. Convert kg/l to the app's base g/ml.
export function parseProductUnit(value: unknown): { unit: ProductUnit; unitLabel?: string; divisor: number } | null {
  const label = normalize(value);
  if (["g", "gram", "grams", "غ", "غرام", "جرام"].includes(label)) return { unit: "g", divisor: 1 };
  if (["kg", "kilogram", "كيلو", "كيلوغرام", "كغ"].includes(label)) return { unit: "g", divisor: 1000 };
  if (["ml", "millilitre", "milliliter", "مل", "ميليلتر", "ميلي لتر", "ملليلتر", "مليلتر"].includes(label)) return { unit: "ml", divisor: 1 };
  if (["l", "litre", "liter", "ل", "لتر"].includes(label)) return { unit: "ml", divisor: 1000 };
  if (countable.has(label)) return { unit: "piece", unitLabel: label, divisor: 1 };
  return null;
}

export const roundAmount = (value: number) => Math.round((value + Number.EPSILON) * 1e8) / 1e8;

export function assertProductQuantity(quantity: number, productUnit: ProductUnit = "piece", expectedUnit: ProductUnit = "piece") {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) throw { status: 400, message: "Quantity must be a positive whole number of pieces, grams or millilitres" };
  if (productUnit !== expectedUnit) throw { status: 409, message: "Product unit changed. Refresh your cart and select the quantity again" };
}
