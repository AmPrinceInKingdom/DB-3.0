"use client";

import { useState } from "react";
import { baseCurrency, supportedCurrencies, type CurrencyCode } from "@/lib/constants/currency";
import { Select } from "@/components/ui/select";

const storageKey = "deal-bazaar:currency";

export function CurrencySelector() {
  const [value, setValue] = useState<CurrencyCode>(() => {
    if (typeof window === "undefined") return baseCurrency;
    const saved = localStorage.getItem(storageKey) as CurrencyCode | null;
    if (saved && supportedCurrencies.some((currency) => currency.code === saved)) {
      return saved;
    }
    return baseCurrency;
  });

  const onChange = (next: CurrencyCode) => {
    setValue(next);
    localStorage.setItem(storageKey, next);
  };

  return (
    <Select
      className="h-9 min-w-[90px] rounded-lg text-xs md:text-sm"
      value={value}
      onChange={(event) => onChange(event.target.value as CurrencyCode)}
      aria-label="Select currency"
    >
      {supportedCurrencies.map((currency) => (
        <option key={currency.code} value={currency.code}>
          {currency.code}
        </option>
      ))}
    </Select>
  );
}
