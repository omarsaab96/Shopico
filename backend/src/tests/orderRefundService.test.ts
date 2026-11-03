import { beforeEach, expect, test, vi } from "vitest";
import mongoose from "mongoose";
import { refundOrderItem } from "../services/orderRefundService";
import { Order } from "../models/Order";
import { Wallet } from "../models/Wallet";
import { WalletTransaction } from "../models/WalletTransaction";
import { Currency } from "../models/Currency";
import { AuditLog } from "../models/AuditLog";

vi.mock("../models/Order", () => ({ Order: { findOne: vi.fn() } }));
vi.mock("../models/Wallet", () => ({ Wallet: { findOne: vi.fn() } }));
vi.mock("../models/WalletTransaction", () => ({ WalletTransaction: { create: vi.fn() } }));
vi.mock("../models/Currency", () => ({ Currency: { findOne: vi.fn() } }));
vi.mock("../models/AuditLog", () => ({ AuditLog: { create: vi.fn() } }));
vi.mock("../models/User", () => ({ User: { findById: vi.fn(() => ({ session: vi.fn().mockResolvedValue(null) })) } }));
vi.mock("../utils/membership", () => ({ updateMembershipOnBalanceChange: vi.fn() }));

const session = {} as mongoose.ClientSession;
const actorId = new mongoose.Types.ObjectId();
let order: any;
let wallet: any;
const payload = () => ({ itemIndex: 0, quantity: 1, requestId: "8aeb4f08-7c70-4007-bd34-65b13029f965", expectedRefundedQuantity: 0, expectedTotal: 110, expectedPaymentStatus: "CONFIRMED", expectedAmount: 25, expectedWalletAmount: 25 });

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(mongoose.connection, "transaction").mockImplementation(async callback => callback(session));
  order = { _id: "order-id", user: "user-id", branchId: "branch-id", currency: "primary", currencyExchangeRate: 1, deliveryDiscount: 0, status: "PENDING", paymentStatus: "CONFIRMED", subtotal: 100, deliveryFee: 10, discount: 0, total: 110, couponDiscount: 0, refundTotal: 0, refunds: [], items: [{ quantity: 2, price: 25 }, { quantity: 1, price: 50 }], save: vi.fn() };
  wallet = { balance: 50, balances: [{ currency: "primary", amount: 50 }], save: vi.fn() };
  vi.mocked(Order.findOne).mockReturnValue({ session: vi.fn().mockImplementation(async provided => { expect(provided).toBe(session); return order; }) } as never);
  vi.mocked(Wallet.findOne).mockReturnValue({ session: vi.fn().mockResolvedValue(wallet) } as never);
  vi.mocked(Currency.findOne).mockImplementation((query: any) => ({ session: vi.fn().mockResolvedValue(query._id === "secondary" ? { _id: "secondary", isPrimary: false, exchangeRate: 200 } : { _id: "primary", isPrimary: true, exchangeRate: 1 }) }) as never);
});

test("credits paid orders and records order, wallet ledger and audit in the same transaction", async () => {
  await refundOrderItem("order-id", "branch-id", actorId, payload());
  expect(Order.findOne).toHaveBeenCalledWith({ _id: "order-id", branchId: "branch-id" });
  expect(order.total).toBe(85);
  expect(order.items[0].refundedQuantity).toBe(1);
  expect(wallet.balance).toBe(75);
  expect(wallet.save).toHaveBeenCalledWith({ session });
  expect(order.save).toHaveBeenCalledWith({ session });
  expect(WalletTransaction.create).toHaveBeenCalledWith([expect.objectContaining({ amount: 25, type: "CREDIT", source: "ORDER_ITEM_REFUND", reference: "order-id" })], { session });
  expect(AuditLog.create).toHaveBeenCalledWith(expect.any(Array), { session });
});

test("unpaid orders reduce their total without touching the wallet", async () => {
  order.paymentStatus = "PENDING";
  await refundOrderItem("order-id", "branch-id", actorId, { ...payload(), expectedPaymentStatus: "PENDING", expectedWalletAmount: 0 });
  expect(order.total).toBe(85);
  expect(Wallet.findOne).not.toHaveBeenCalled();
  expect(WalletTransaction.create).not.toHaveBeenCalled();
  expect(order.refunds[0].disposition).toBe("TOTAL_REDUCTION");
});

test("retries with the same request id cannot credit twice", async () => {
  await refundOrderItem("order-id", "branch-id", actorId, payload());
  await refundOrderItem("order-id", "branch-id", actorId, payload());
  expect(WalletTransaction.create).toHaveBeenCalledTimes(1);
  expect(wallet.balance).toBe(75);
  expect(order.refunds).toHaveLength(1);
});

test("stale previews are rejected before financial writes", async () => {
  await expect(refundOrderItem("order-id", "branch-id", actorId, { ...payload(), expectedTotal: 99 })).rejects.toMatchObject({ status: 409 });
  expect(Wallet.findOne).not.toHaveBeenCalled();
  expect(order.save).not.toHaveBeenCalled();
});

test("wallet refunds use the checkout exchange rate instead of a changed current rate", async () => {
  order.currency = "secondary";
  order.currencyExchangeRate = 100;
  await refundOrderItem("order-id", "branch-id", actorId, { ...payload(), expectedWalletAmount: 0.25 });
  expect(wallet.balances.find((entry: any) => entry.currency === "secondary").amount).toBe(0.25);
  expect(wallet.balance).toBe(50);
  expect(WalletTransaction.create).toHaveBeenCalledWith([expect.objectContaining({ currency: "secondary", amount: 0.25 })], { session });
});

test("rejects missing orders without wallet writes", async () => {
  order = null;
  await expect(refundOrderItem("missing", "branch-id", actorId, payload())).rejects.toMatchObject({ status: 404 });
  expect(Wallet.findOne).not.toHaveBeenCalled();
});

test("rejects a preview whose payment status changed", async () => {
  order.paymentStatus = "PENDING";
  await expect(refundOrderItem("order-id", "branch-id", actorId, payload())).rejects.toMatchObject({ status: 409 });
  expect(Wallet.findOne).not.toHaveBeenCalled();
  expect(order.save).not.toHaveBeenCalled();
});

test("propagates a ledger failure through the transaction without saving the order", async () => {
  vi.mocked(WalletTransaction.create).mockRejectedValueOnce(new Error("ledger unavailable") as never);
  await expect(refundOrderItem("order-id", "branch-id", actorId, payload())).rejects.toThrow("ledger unavailable");
  expect(wallet.save).toHaveBeenCalledWith({ session });
  expect(order.save).not.toHaveBeenCalled();
  expect(AuditLog.create).not.toHaveBeenCalled();
});
