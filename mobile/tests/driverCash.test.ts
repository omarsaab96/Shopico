import { expect, test } from "vitest";
import { outstandingDriverCash } from "../lib/driverCash";
const syp = { _id: "syp", symbol: { en: "SYP" } };
const usd = { _id: "usd", symbol: { en: "USD" } };
const order = { status: "DELIVERED", paymentMethod: "CASH_ON_DELIVERY", paymentStatus: "PENDING", total: 100, currency: syp };
test("counts only delivered, unsettled cash and drops received payments", () => {
  expect(outstandingDriverCash([order, { ...order, paymentStatus: "CONFIRMED" }, { ...order, status: "SHIPPING" }, { ...order, paymentMethod: "WALLET" }], syp))
    .toEqual([{ amount: 100, currency: syp }]);
  expect(outstandingDriverCash([{ ...order, paymentStatus: "CONFIRMED" }], syp)).toEqual([]);
});
test("never adds amounts from different currencies", () => {
  expect(outstandingDriverCash([order, { ...order, total: 2.25, currency: usd }], syp))
    .toEqual([{ amount: 100, currency: syp }, { amount: 2.25, currency: usd }]);
});
test("legacy orders use primary currency without exchanging cash amounts", () => {
  expect(outstandingDriverCash([{ ...order, currency: null }], syp)).toEqual([{ amount: 100, currency: syp }]);
});
test("decimal totals do not accumulate floating-point noise", () => {
  expect(outstandingDriverCash([{ ...order, total: 0.1 }, { ...order, total: 0.2 }], syp)[0].amount).toBe(0.3);
});
