import { Currency, ICurrency } from "../models/Currency";

const defaultCurrency = {
  symbol: { en: "SYP", ar: "ل.س" },
  exchangeRate: 1,
  isPrimary: true,
  isActive: true,
};

export const ensureDefaultCurrency = async (branchId: string) => {
  const count = await Currency.countDocuments({ branchId });
  if (count === 0) {
    return Currency.create({ ...defaultCurrency, branchId });
  }
  const primary = await Currency.findOne({ branchId, isPrimary: true });
  if (!primary) {
    const first = await Currency.findOne({ branchId }).sort({ createdAt: 1 });
    if (first) {
      first.isPrimary = true;
      first.exchangeRate = 1;
      await first.save();
      return first;
    }
  }
  return primary;
};

export const listCurrencies = async (branchId: string, q?: string) => {
  await ensureDefaultCurrency(branchId);
  const filter: Record<string, unknown> = { branchId };
  if (q) {
    filter.$or = [
      { "symbol.en": { $regex: q, $options: "i" } },
      { "symbol.ar": { $regex: q, $options: "i" } },
    ];
  }
  return Currency.find(filter).sort({ isPrimary: -1, "symbol.en": 1 });
};

export const createCurrency = async (
  branchId: string,
  payload: Pick<ICurrency, "symbol" | "exchangeRate"> & Partial<ICurrency>
) => {
  const existingCount = await Currency.countDocuments({ branchId });
  const isPrimary = existingCount === 0 || Boolean(payload.isPrimary);
  if (isPrimary) {
    await Currency.updateMany({ branchId }, { $set: { isPrimary: false } });
  }
  const currency = await Currency.create({
    ...payload,
    branchId,
    exchangeRate: isPrimary ? 1 : payload.exchangeRate,
    isPrimary,
  });
  return currency;
};

export const updateCurrency = async (
  branchId: string,
  id: string,
  payload: Partial<Pick<ICurrency, "symbol" | "exchangeRate" | "isPrimary" | "isActive">>
) => {
  const currency = await Currency.findOne({ _id: id, branchId });
  if (!currency) return null;

  if (payload.isPrimary) {
    await Currency.updateMany({ branchId, _id: { $ne: id } }, { $set: { isPrimary: false } });
    currency.isPrimary = true;
    currency.exchangeRate = 1;
  } else if (payload.exchangeRate !== undefined && !currency.isPrimary) {
    currency.exchangeRate = payload.exchangeRate;
  }

  if (payload.symbol !== undefined) currency.symbol = payload.symbol;
  if (payload.isActive !== undefined) currency.isActive = payload.isActive;

  if (currency.isPrimary) {
    currency.exchangeRate = 1;
    currency.isActive = true;
  }

  await currency.save();
  return currency;
};

export const deleteCurrency = async (branchId: string, id: string) => {
  const currency = await Currency.findOne({ _id: id, branchId });
  if (!currency) return { currency: null, error: "" };
  if (currency.isPrimary) {
    return { currency: null, error: "Primary currency cannot be deleted" };
  }
  await currency.deleteOne();
  return { currency, error: "" };
};
