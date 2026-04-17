import { baseCurrency, supportedCurrencies, type CurrencyCode } from "@/lib/constants/currency";

export const seededExchangeRatesFromBase: Record<CurrencyCode, number> = {
  LKR: 1,
  USD: 0.0033,
  EUR: 0.003,
  GBP: 0.0026,
  INR: 0.27,
};

export function getCurrencyDecimals(currency: CurrencyCode) {
  const config = supportedCurrencies.find((item) => item.code === currency);
  return config?.decimals ?? 2;
}

export function roundMoney(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function convertFromBaseCurrency(amountInBase: number, toCurrency: CurrencyCode) {
  const rate = seededExchangeRatesFromBase[toCurrency] ?? 1;
  const decimals = getCurrencyDecimals(toCurrency);
  return roundMoney(amountInBase * rate, decimals);
}

export function getExchangeRateToBase(currency: CurrencyCode) {
  if (currency === baseCurrency) return 1;
  return seededExchangeRatesFromBase[currency] ?? 1;
}
