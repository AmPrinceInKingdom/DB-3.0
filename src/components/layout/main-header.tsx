"use client";

import Link from "next/link";
import { type FormEvent, type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { GitCompareArrows, Heart, Search, ShoppingCart, User } from "lucide-react";
import { publicNavItems } from "@/lib/constants/navigation";
import { formatCurrency } from "@/lib/utils";
import { CurrencySelector } from "@/components/layout/currency-selector";
import { LanguageSelector } from "@/components/layout/language-selector";
import { Logo } from "@/components/layout/logo";
import { NotificationBell } from "@/components/layout/notification-bell";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCartStore } from "@/store/cart-store";
import { useCompareStore } from "@/store/compare-store";
import { useUiPreferencesStore } from "@/store/ui-preferences-store";
import { useWishlistStore } from "@/store/wishlist-store";

type Props = {
  siteName?: string;
  logoUrl?: string;
};

type PublicSettingsResponse = {
  success: boolean;
  data?: {
    siteName: string;
    logoUrl: string;
  };
};

type SuggestionItem = {
  id: string;
  name: string;
  slug: string;
  brand: string;
  category: string;
  imageUrl: string;
  price: number;
};

type SuggestionsResponse = {
  success: boolean;
  data?: {
    query: string;
    items: SuggestionItem[];
  };
};

type AuthRole = "CUSTOMER" | "ADMIN" | "SUPER_ADMIN" | "SELLER";

type AuthMeResponse = {
  success: boolean;
  data?: {
    id: string;
    email: string;
    role: AuthRole;
  };
};

function normalizeSearchTerm(value: string) {
  return value.trim();
}

export function MainHeader({
  siteName: initialSiteName = "Deal Bazaar",
  logoUrl: initialLogoUrl = "",
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const totalCartItems = useCartStore((state) =>
    state.items.reduce((sum, item) => sum + item.quantity, 0),
  );
  const totalWishlistItems = useWishlistStore((state) => state.items.length);
  const totalCompareItems = useCompareStore((state) => state.items.length);
  const selectedCurrency = useUiPreferencesStore((state) => state.currency);
  const [siteName, setSiteName] = useState(initialSiteName);
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [authRole, setAuthRole] = useState<AuthRole | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const normalizedSearch = useMemo(() => normalizeSearchTerm(searchTerm), [searchTerm]);

  const cancelPendingClose = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  const closeSuggestionsSoon = useCallback(() => {
    cancelPendingClose();
    closeTimeoutRef.current = setTimeout(() => {
      setIsSuggestionsOpen(false);
      setHighlightedIndex(-1);
    }, 140);
  }, [cancelPendingClose]);

  const openSuggestions = useCallback(() => {
    cancelPendingClose();
    if (normalizedSearch.length >= 2) {
      setIsSuggestionsOpen(true);
    }
  }, [cancelPendingClose, normalizedSearch.length]);

  const handleSuggestionSelect = useCallback(
    (suggestion: SuggestionItem) => {
      cancelPendingClose();
      setSearchTerm(suggestion.name);
      setIsSuggestionsOpen(false);
      setHighlightedIndex(-1);
      router.push(`/product/${suggestion.slug}`);
    },
    [cancelPendingClose, router],
  );

  const handleSearchSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const query = normalizeSearchTerm(searchTerm);

      if (!query) {
        setSuggestions([]);
        setIsSuggestionsOpen(false);
        router.push("/shop");
        return;
      }

      setIsSuggestionsOpen(false);
      setHighlightedIndex(-1);
      router.push(`/shop?q=${encodeURIComponent(query)}`);
    },
    [router, searchTerm],
  );

  const handleInputKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (!isSuggestionsOpen || suggestions.length === 0) {
        if (event.key === "Escape") {
          setIsSuggestionsOpen(false);
          setHighlightedIndex(-1);
        }
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setHighlightedIndex((current) => (current + 1) % suggestions.length);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setHighlightedIndex((current) => (current <= 0 ? suggestions.length - 1 : current - 1));
        return;
      }

      if (event.key === "Enter" && highlightedIndex >= 0 && suggestions[highlightedIndex]) {
        event.preventDefault();
        handleSuggestionSelect(suggestions[highlightedIndex]);
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        setIsSuggestionsOpen(false);
        setHighlightedIndex(-1);
      }
    },
    [handleSuggestionSelect, highlightedIndex, isSuggestionsOpen, suggestions],
  );

  useEffect(() => {
    const controller = new AbortController();

    const loadSiteName = async () => {
      try {
        const response = await fetch("/api/public/settings", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const payload = (await response.json()) as PublicSettingsResponse;
        if (payload.success && payload.data?.siteName?.trim()) {
          setSiteName(payload.data.siteName.trim());
        }
        if (payload.success && typeof payload.data?.logoUrl === "string") {
          setLogoUrl(payload.data.logoUrl.trim());
        }
      } catch {
        // Keep fallback name.
      }
    };

    void loadSiteName();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const loadAuthProfile = async () => {
      try {
        const response = await fetch("/api/auth/me", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) {
          setAuthRole(null);
          return;
        }

        const payload = (await response.json()) as AuthMeResponse;
        if (!payload.success || !payload.data?.role) {
          setAuthRole(null);
          return;
        }

        setAuthRole(payload.data.role);
      } catch {
        setAuthRole(null);
      }
    };

    void loadAuthProfile();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (normalizedSearch.length < 2) {
      setSuggestions([]);
      setSuggestionsLoading(false);
      setHighlightedIndex(-1);
      return;
    }

    const controller = new AbortController();
    setSuggestionsLoading(true);

    const debounce = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/search/suggestions?q=${encodeURIComponent(normalizedSearch)}&limit=6`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          setSuggestions([]);
          setHighlightedIndex(-1);
          return;
        }

        const payload = (await response.json()) as SuggestionsResponse;
        const nextSuggestions = payload.success ? payload.data?.items ?? [] : [];
        setSuggestions(nextSuggestions);
        setHighlightedIndex(nextSuggestions.length > 0 ? 0 : -1);
      } catch {
        setSuggestions([]);
        setHighlightedIndex(-1);
      } finally {
        setSuggestionsLoading(false);
      }
    }, 260);

    return () => {
      clearTimeout(debounce);
      controller.abort();
    };
  }, [normalizedSearch]);

  useEffect(() => {
    return () => {
      cancelPendingClose();
    };
  }, [cancelPendingClose]);

  const showSuggestionPanel = isSuggestionsOpen && normalizedSearch.length >= 2;
  const isAuthenticated = Boolean(authRole);
  const accountHref =
    authRole === "ADMIN" || authRole === "SUPER_ADMIN"
      ? "/admin"
      : authRole === "SELLER"
        ? "/seller/dashboard"
        : "/account";
  const accountLabel =
    authRole === "ADMIN" || authRole === "SUPER_ADMIN"
      ? "Admin"
      : authRole === "SELLER"
        ? "Seller"
        : "My Account";
  const showMobilePreferences = pathname.startsWith("/account");

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/95 backdrop-blur-md">
      <div className="container-app py-3">
        <div className="flex items-center gap-3 md:gap-6">
          <Logo className="shrink-0" name={siteName} logoUrl={logoUrl} />
          <div className="hidden flex-1 lg:block">
            <form onSubmit={handleSearchSubmit} className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search for products, brands, and deals..."
                className="h-10 rounded-xl pl-9 pr-20"
                aria-label="Search"
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setIsSuggestionsOpen(true);
                }}
                onFocus={openSuggestions}
                onBlur={closeSuggestionsSoon}
                onKeyDown={handleInputKeyDown}
                autoComplete="off"
              />
              <Button
                type="submit"
                size="sm"
                className="absolute right-1.5 top-1/2 h-7 -translate-y-1/2 px-3 text-xs"
              >
                Search
              </Button>

              {showSuggestionPanel ? (
                <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-xl border border-border bg-card shadow-xl">
                  {suggestionsLoading ? (
                    <p className="px-3 py-2 text-xs text-muted-foreground">Searching products...</p>
                  ) : suggestions.length > 0 ? (
                    <ul className="max-h-96 overflow-y-auto">
                      {suggestions.map((item, index) => (
                        <li key={`${item.id}-${item.slug}`}>
                          <button
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => handleSuggestionSelect(item)}
                            className={`flex w-full items-center gap-3 px-3 py-2 text-left transition ${
                              index === highlightedIndex
                                ? "bg-primary/10"
                                : "hover:bg-muted/70"
                            }`}
                          >
                            {item.imageUrl ? (
                              <span
                                className="h-10 w-10 shrink-0 rounded-md border border-border bg-muted bg-cover bg-center"
                                style={{ backgroundImage: `url("${item.imageUrl}")` }}
                              />
                            ) : (
                              <span className="h-10 w-10 shrink-0 rounded-md border border-border bg-muted" />
                            )}
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold">{item.name}</span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {item.brand} - {item.category}
                              </span>
                            </span>
                            <span className="shrink-0 text-xs font-semibold text-primary">
                              {formatCurrency(item.price, selectedCurrency)}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="px-3 py-2 text-xs text-muted-foreground">
                      No products found for &quot;{normalizedSearch}&quot;.
                    </p>
                  )}
                </div>
              ) : null}
            </form>
          </div>
          <div className="ml-auto hidden items-center gap-2 lg:flex">
            <CurrencySelector />
            <LanguageSelector />
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Wishlist (${totalWishlistItems} items)`}
              asChild
            >
              <Link href="/wishlist" className="relative">
                <Heart className="h-4 w-4" />
                {totalWishlistItems > 0 ? (
                  <span className="absolute -right-1 -top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
                    {totalWishlistItems > 99 ? "99+" : totalWishlistItems}
                  </span>
                ) : null}
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Compare (${totalCompareItems} items)`}
              asChild
            >
              <Link href="/compare" className="relative">
                <GitCompareArrows className="h-4 w-4" />
                {totalCompareItems > 0 ? (
                  <span className="absolute -right-1 -top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
                    {totalCompareItems > 99 ? "99+" : totalCompareItems}
                  </span>
                ) : null}
              </Link>
            </Button>
            {isAuthenticated ? (
              <NotificationBell
                title="Notifications"
                notificationsEndpoint="/api/account/notifications"
                realtimeStreamEndpoint="/api/account/notifications/stream"
                notificationUpdateBasePath="/api/account/notifications"
                markAllEndpoint="/api/account/notifications/read-all"
                viewAllHref="/account/notifications"
                emptyMessage="No personal notifications right now."
                quickPushToggleEndpoint="/api/account/settings/notifications"
                settingsHref="/account/settings"
              />
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Cart (${totalCartItems} items)`}
              asChild
            >
              <Link href="/cart" className="relative">
                <ShoppingCart className="h-4 w-4" />
                {totalCartItems > 0 ? (
                  <span className="absolute -right-1 -top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
                    {totalCartItems > 99 ? "99+" : totalCartItems}
                  </span>
                ) : null}
              </Link>
            </Button>
            {isAuthenticated ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={accountHref}>
                  <User className="h-4 w-4" />
                  {accountLabel}
                </Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" asChild>
                <Link href="/login">
                  <User className="h-4 w-4" />
                  Sign In
                </Link>
              </Button>
            )}
          </div>
        </div>
        <form onSubmit={handleSearchSubmit} className="relative mt-3 lg:hidden">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            className="h-10 rounded-xl pl-9 pr-20"
            aria-label="Search"
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value);
              setIsSuggestionsOpen(true);
            }}
            onFocus={openSuggestions}
            onBlur={closeSuggestionsSoon}
            onKeyDown={handleInputKeyDown}
            autoComplete="off"
          />
          <Button
            type="submit"
            size="sm"
            className="absolute right-1.5 top-1/2 h-7 -translate-y-1/2 px-3 text-xs"
          >
            Search
          </Button>

          {showSuggestionPanel ? (
            <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-xl border border-border bg-card shadow-xl">
              {suggestionsLoading ? (
                <p className="px-3 py-2 text-xs text-muted-foreground">Searching products...</p>
              ) : suggestions.length > 0 ? (
                <ul className="max-h-80 overflow-y-auto">
                  {suggestions.map((item, index) => (
                    <li key={`mobile-${item.id}-${item.slug}`}>
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => handleSuggestionSelect(item)}
                        className={`flex w-full items-center gap-3 px-3 py-2 text-left transition ${
                          index === highlightedIndex ? "bg-primary/10" : "hover:bg-muted/70"
                        }`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{item.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {item.brand} - {item.category}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs font-semibold text-primary">
                          {formatCurrency(item.price, selectedCurrency)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-3 py-2 text-xs text-muted-foreground">
                  No products found for &quot;{normalizedSearch}&quot;.
                </p>
              )}
            </div>
          ) : null}
        </form>
        {showMobilePreferences ? (
          <div className="mt-3 grid grid-cols-3 gap-2 lg:hidden">
            <CurrencySelector />
            <LanguageSelector />
            <ThemeToggle />
          </div>
        ) : null}
        <nav className="mt-3 hidden items-center gap-5 overflow-x-auto text-sm font-medium lg:flex">
          {publicNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
