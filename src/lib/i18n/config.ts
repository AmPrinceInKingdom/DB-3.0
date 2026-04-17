export const locales = ["en", "si"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export const localeLabels: Record<Locale, string> = {
  en: "English",
  si: "සිංහල",
};

export type TranslationDictionary = Record<string, string>;
