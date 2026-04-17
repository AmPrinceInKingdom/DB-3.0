"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CurrencyCode } from "@/lib/constants/currency";
import type { Locale } from "@/lib/i18n/config";

type UiPreferencesState = {
  currency: CurrencyCode;
  language: Locale;
  setCurrency: (currency: CurrencyCode) => void;
  setLanguage: (language: Locale) => void;
};

export const useUiPreferencesStore = create<UiPreferencesState>()(
  persist(
    (set) => ({
      currency: "LKR",
      language: "en",
      setCurrency: (currency) => set({ currency }),
      setLanguage: (language) => set({ language }),
    }),
    {
      name: "deal-bazaar-ui-preferences",
    },
  ),
);
