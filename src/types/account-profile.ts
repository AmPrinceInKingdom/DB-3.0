export type AccountProfileState = {
  id: string;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string;
  preferredCurrency: string;
  preferredLanguage: "en" | "si";
  themePreference: "system" | "light" | "dark";
  createdAt: string;
  lastLoginAt: string | null;
};

export type AccountProfilePayload = {
  profile: AccountProfileState;
  options: {
    currencies: Array<{
      code: string;
      name: string;
      symbol: string;
    }>;
    languages: Array<{
      code: "en" | "si";
      label: string;
    }>;
    themeModes: Array<"system" | "light" | "dark">;
  };
};
