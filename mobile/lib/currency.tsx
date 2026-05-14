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
      if (!currency || typeof currency === "string") return t("syp");
      const symbol = currency.symbol || {};
      const localized = lang === "ar" ? symbol.ar : symbol.en;
      return localized || symbol.en || symbol.ar || t("syp");
    },
    [lang, t]
  );

  const convertFromPrimary = useCallback((amount: number, currency?: Currency) => {
    const rate = Number(currency?.exchangeRate || 1);
    return Number(amount || 0) / (rate > 0 ? rate : 1);
  }, []);

  const formatMoney = useCallback(
    (amount: number, currency = selectedCurrency) => {
      const value = convertFromPrimary(amount, currency);
      const decimals = currency?.isPrimary ? 0 : 2;
      return `${value.toLocaleString(undefined, { maximumFractionDigits: decimals })} ${getCurrencySymbol(currency)}`;
    },
    [convertFromPrimary, getCurrencySymbol, selectedCurrency]
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
    ]
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
};

export const useCurrency = () => {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
};
