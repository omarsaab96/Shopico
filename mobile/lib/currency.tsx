import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import api from "./api";
import { useI18n } from "./i18n";

export type Currency = {
  _id: string;
  symbol: {
    en: string;
    ar?: string;
  };
  exchangeRate: number;
  isPrimary: boolean;
  isActive: boolean;
};

type WalletBalance = {
  currency?: Currency | string;
  amount: number;
};

type MembershipThresholds = {
  silver: number;
  gold: number;
  platinum: number;
  diamond: number;
};

const getCurrencyId = (currency?: Currency | string) => {
  if (!currency) return "";
  return typeof currency === "string" ? currency : currency._id || "";
};

type CurrencyContextValue = {
  currencies: Currency[];
  primaryCurrency?: Currency;
  selectedCurrency?: Currency;
  selectedCurrencyId: string;
  setSelectedCurrencyId: (currencyId: string) => void;
  refreshCurrencies: () => Promise<void>;
  getCurrencySymbol: (currency?: Currency | string) => string;
  convertFromPrimary: (amount: number, currency?: Currency) => number;
  formatMoney: (amount: number, currency?: Currency) => string;
  getWalletBalance: (wallet?: any, currency?: Currency) => number;
  getMembershipThresholds: (settings?: any, currency?: Currency) => MembershipThresholds;
  getMembershipLevel: (balance: number, thresholds: MembershipThresholds) => string;
};

const CURRENCY_STORAGE_KEY = "selected-currency-id";

const CurrencyContext = createContext<CurrencyContextValue | undefined>(undefined);

export const CurrencyProvider = ({ children }: { children: ReactNode }) => {
  const { lang, t } = useI18n();
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [selectedCurrencyId, setSelectedCurrencyIdState] = useState("");

  const primaryCurrency = useMemo(
    () => currencies.find((currency) => currency.isPrimary) || currencies[0],
    [currencies]
  );

  const selectedCurrency = useMemo(
    () => currencies.find((currency) => currency._id === selectedCurrencyId) || primaryCurrency,
    [currencies, selectedCurrencyId, primaryCurrency]
  );

  const resolveCurrency = useCallback(
    (currency?: Currency | string) => {
      const currencyId = getCurrencyId(currency);
      const fromList = currencyId ? currencies.find((item) => item._id === currencyId) : undefined;
      return fromList || (typeof currency === "string" ? undefined : currency) || selectedCurrency;
    },
    [currencies, selectedCurrency]
  );

  const refreshCurrencies = useCallback(async () => {
    try {
      const res = await api.get("/currencies");
      const activeCurrencies: Currency[] = (res.data.data || []).filter((currency: Currency) => currency.isActive);
      const storedId = await AsyncStorage.getItem(CURRENCY_STORAGE_KEY);
      const primary = activeCurrencies.find((currency) => currency.isPrimary) || activeCurrencies[0];
      const nextSelected = activeCurrencies.find((currency) => currency._id === storedId) || primary;
      setCurrencies(activeCurrencies);
      setSelectedCurrencyIdState(nextSelected?._id || "");
    } catch {
      setCurrencies([]);
      setSelectedCurrencyIdState("");
    }
  }, []);

  useEffect(() => {
    refreshCurrencies();
  }, [refreshCurrencies]);

  const setSelectedCurrencyId = (currencyId: string) => {
    setSelectedCurrencyIdState(currencyId);
    AsyncStorage.setItem(CURRENCY_STORAGE_KEY, currencyId).catch(() => {});
  };

  const getCurrencySymbol = useCallback(
    (currency?: Currency | string) => {
      const resolved = resolveCurrency(currency);
      if (!resolved) return t("syp");
      const symbol = resolved.symbol || {};
      const localized = lang === "ar" ? symbol.ar : symbol.en;
      return localized || symbol.en || symbol.ar || t("syp");
    },
    [lang, resolveCurrency, t]
  );

  const convertFromPrimary = useCallback((amount: number, currency?: Currency) => {
    const resolved = resolveCurrency(currency);
    const rate = Number(resolved?.exchangeRate || 1);
    return Number(amount || 0) / (rate > 0 ? rate : 1);
  }, [resolveCurrency]);

  const formatMoney = useCallback(
    (amount: number, currency = selectedCurrency) => {
      const resolved = resolveCurrency(currency);
      const value = convertFromPrimary(amount, resolved);
      const decimals = resolved?.isPrimary ? 0 : 2;
      return `${value.toLocaleString(undefined, { maximumFractionDigits: decimals })} ${getCurrencySymbol(resolved)}`;
    },
    [convertFromPrimary, getCurrencySymbol, resolveCurrency, selectedCurrency]
  );

  const getWalletBalance = useCallback(
    (wallet?: any, currency = selectedCurrency) => {
      if (!wallet) return 0;
      const balances: WalletBalance[] = wallet?.balances || wallet?.wallet?.balances || [];
      const currencyId = currency?._id;
      if (currencyId) {
        const match = balances.find((entry) => {
          return getCurrencyId(entry.currency) === currencyId;
        });
        return Number(match?.amount || 0);
      }
      const primaryBalance = balances.find((entry) => {
        const entryCurrency = entry.currency;
        return typeof entryCurrency !== "string" && entryCurrency?.isPrimary;
      });
      if (primaryBalance) return Number(primaryBalance.amount || 0);
      if (balances.length > 0) return Number(balances[0]?.amount || 0);
      return Number(wallet?.balance || wallet?.wallet?.balance || 0);
    },
    [selectedCurrency]
  );

  const getMembershipThresholds = useCallback((settings?: any, currency = selectedCurrency): MembershipThresholds => {
    const legacy = settings?.membershipThresholds || {
      silver: 1000000,
      gold: 2000000,
      platinum: 4000000,
      diamond: 6000000,
    };
    const currencyId = currency?._id;
    const match = (settings?.membershipThresholdsByCurrency || []).find((entry: any) => getCurrencyId(entry.currency) === currencyId);
    if (match?.thresholds) return match.thresholds;
    if (!currency || currency.isPrimary) return legacy;
    const rate = Number(currency.exchangeRate || 1);
    return {
      silver: Math.round(Number(legacy.silver || 0) / rate),
      gold: Math.round(Number(legacy.gold || 0) / rate),
      platinum: Math.round(Number(legacy.platinum || 0) / rate),
      diamond: Math.round(Number(legacy.diamond || 0) / rate),
    };
  }, [selectedCurrency]);

  const getMembershipLevel = useCallback((balance: number, thresholds: MembershipThresholds) => {
    if (balance >= Number(thresholds.diamond || 0)) return "Diamond";
    if (balance >= Number(thresholds.platinum || 0)) return "Platinum";
    if (balance >= Number(thresholds.gold || 0)) return "Gold";
    if (balance >= Number(thresholds.silver || 0)) return "Silver";
    return "None";
  }, []);

  const value = useMemo(
    () => ({
      currencies,
      primaryCurrency,
      selectedCurrency,
      selectedCurrencyId,
      setSelectedCurrencyId,
      refreshCurrencies,
      getCurrencySymbol,
      convertFromPrimary,
      formatMoney,
      getWalletBalance,
      getMembershipThresholds,
      getMembershipLevel,
    }),
    [
      currencies,
      primaryCurrency,
      selectedCurrency,
      selectedCurrencyId,
      refreshCurrencies,
      getCurrencySymbol,
      convertFromPrimary,
      formatMoney,
      getWalletBalance,
      getMembershipThresholds,
      getMembershipLevel,
    ]
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
};

export const useCurrency = () => {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
};
