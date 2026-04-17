"use client";

import { useState } from "react";
import { defaultLocale, localeLabels, locales, type Locale } from "@/lib/i18n/config";
import { Select } from "@/components/ui/select";

const storageKey = "deal-bazaar:locale";

export function LanguageSelector() {
  const [value, setValue] = useState<Locale>(() => {
    if (typeof window === "undefined") return defaultLocale;
    const saved = localStorage.getItem(storageKey) as Locale | null;
    if (saved && locales.includes(saved)) {
      return saved;
    }
    return defaultLocale;
  });

  const onChange = (next: Locale) => {
    setValue(next);
    localStorage.setItem(storageKey, next);
  };

  return (
    <Select
      className="h-9 min-w-[100px] rounded-lg text-xs md:text-sm"
      value={value}
      onChange={(event) => onChange(event.target.value as Locale)}
      aria-label="Select language"
    >
      {locales.map((locale) => (
        <option key={locale} value={locale}>
          {localeLabels[locale]}
        </option>
      ))}
    </Select>
  );
}
