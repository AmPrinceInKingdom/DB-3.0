export type CurrencyCode = "LKR" | "USD" | "EUR" | "GBP" | "INR";

export type CurrencyConfig = {
  code: CurrencyCode;
  symbol: string;
  name: string;
  decimals: number;
};

export const supportedCurrencies: CurrencyConfig[] = [
  { code: "LKR", symbol: "Rs", name: "Sri Lankan Rupee", decimals: 0 },
  { code: "USD", symbol: "$", name: "US Dollar", decimals: 2 },
  { code: "EUR", symbol: "€", name: "Euro", decimals: 2 },
  { code: "GBP", symbol: "£", name: "British Pound", decimals: 2 },
  { code: "INR", symbol: "₹", name: "Indian Rupee", decimals: 2 },
];

export const baseCurrency: CurrencyCode = "LKR";
