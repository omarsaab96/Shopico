import { expect, test } from "vitest";
import * as xlsx from "xlsx";
import { parseProductUnit, assertProductQuantity } from "../utils/productUnits";
import { readImportEntries, decideImportActions } from "../controllers/productController";

const workbook = (rows: unknown[][]) => {
  const book = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(book, xlsx.utils.aoa_to_sheet(rows), "Products");
  return xlsx.write(book, { type: "buffer", bookType: "biff8" }) as Buffer;
};

test("Excel units convert source prices without guessing from product names", () => {
  const entries = readImportEntries(workbook([
    ["Stock report"], [], ["الرمز", "الاسم", "المستهلك", "واحدة   القياس", "الرصيد الحالي"],
    ["001", "Packaged milk 500 ml", 350, "قطعة", 4],
    ["002", "Walnuts", 0.6, "غرام", 600],
    ["003", "Bulk bags", 430, "كيلو", 24],
    ["004", "Liquid", 800, "لتر", 5],
    ["005", "Liquid by ml", 0.08, "ml", 200],
    ["006", "Box", 120, "علبة", 2],
    ["007", "Length", 90, "متر", 4],
  ]));
  expect(entries.map(row => [row.unit, row.price])).toEqual([
    ["piece", 350], ["g", 0.6], ["g", 0.43], ["ml", 0.8], ["ml", 0.08], ["piece", 120], [undefined, 90],
  ]);
  const decisions = decideImportActions(entries, new Map());
  expect(decisions.created).toBe(6);
  expect(decisions.decisions[6]).toMatchObject({ action: "skip", reason: "invalid_unit" });
  expect(entries[0].barcode).toBe("001");
  expect(entries[5].unitLabel).toBe("علبة");
});

test("unit-only changes appear in import preview and identical imports are skipped", () => {
  const entries = readImportEntries(workbook([["الرمز", "الاسم", "المستهلك", "وحدة القياس", "الرصيد الحالي"], ["001", "Walnuts", 0.6, "غرام", 500]]));
  const previous = { name: "Walnuts", price: 0.6, isAvailable: true, unit: "piece" as const };
  expect(decideImportActions(entries, new Map([["001", previous]])).decisions[0]).toMatchObject({ action: "update", reasonDetail: "unit", previousUnit: "piece", unit: "g" });
  expect(decideImportActions(entries, new Map([["001", { ...previous, unit: "g" }]])).decisions[0].action).toBe("skip");
});

test("imports without a unit column preserve an existing unit and default new products to pieces", () => {
  const entries = readImportEntries(workbook([["الرمز", "الاسم", "المستهلك", "الرصيد الحالي"], ["001", "Existing", 2, 100], ["002", "New", 12, 2]]));
  const result = decideImportActions(entries, new Map([["001", { name: "Existing", price: 1, unit: "ml", isAvailable: true }]]));
  expect(result.decisions.map(row => row.unit)).toEqual(["ml", "piece"]);
});

test("unit changes cannot silently reuse promotion or variant prices in a different unit", () => {
  const entries = readImportEntries(workbook([["الرمز", "الاسم", "المستهلك", "واحدة القياس", "الرصيد الحالي"], ["001", "Walnuts", 0.6, "غرام", 500]]));
  for (const overrides of [{ isPromoted: true }, { variants: [{ price: 500 }] }]) {
    expect(decideImportActions(entries, new Map([["001", { unit: "piece", ...overrides }]])).decisions[0]).toMatchObject({ action: "skip", reason: "unit_change_with_prices" });
  }
});

test("countable packages stay countable and unknown units are rejected", () => {
  for (const unit of ["قطعة", "كيس", "زوج", "طقم", "علبة"]) expect(parseProductUnit(unit)?.unit).toBe("piece");
  for (const unit of ["غ", "g", "غرام", "جرام"]) expect(parseProductUnit(unit)?.unit).toBe("g");
  expect(parseProductUnit("مجهول")).toBeNull();
  expect(parseProductUnit("")).toBeNull();
});

test("quantities are whole base units and stale cart units are rejected", () => {
  for (const quantity of [0, -1, 0.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1]) expect(() => assertProductQuantity(quantity, "g", "g")).toThrow();
  expect(() => assertProductQuantity(250, "g", "g")).not.toThrow();
  expect(() => assertProductQuantity(250, "g", "piece")).toThrow();
});
