"use client";

import Link from "next/link";
import { GitCompareArrows, Heart, Home, Search, ShoppingCart, User } from "lucide-react";
import { useCartStore } from "@/store/cart-store";
import { useCompareStore } from "@/store/compare-store";
import { useWishlistStore } from "@/store/wishlist-store";

const items = [
  { href: "/", label: "Home", icon: Home },
  { href: "/shop", label: "Shop", icon: Search },
  { href: "/compare", label: "Compare", icon: GitCompareArrows },
  { href: "/wishlist", label: "Wishlist", icon: Heart },
  { href: "/cart", label: "Cart", icon: ShoppingCart },
  { href: "/account", label: "Account", icon: User },
];

export function MobileBottomNav() {
  const totalCartItems = useCartStore((state) =>
    state.items.reduce((sum, item) => sum + item.quantity, 0),
  );
  const totalWishlistItems = useWishlistStore((state) => state.items.length);
  const totalCompareItems = useCompareStore((state) => state.items.length);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 px-2 py-2 backdrop-blur lg:hidden">
      <ul className="mx-auto grid max-w-lg grid-cols-6 gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className="relative flex flex-col items-center gap-1 rounded-lg py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
              >
                <Icon className="h-4 w-4" />
                {item.href === "/compare" && totalCompareItems > 0 ? (
                  <span className="absolute right-2 top-0 inline-flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
                    {totalCompareItems > 99 ? "99+" : totalCompareItems}
                  </span>
                ) : null}
                {item.href === "/wishlist" && totalWishlistItems > 0 ? (
                  <span className="absolute right-2 top-0 inline-flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
                    {totalWishlistItems > 99 ? "99+" : totalWishlistItems}
                  </span>
                ) : null}
                {item.href === "/cart" && totalCartItems > 0 ? (
                  <span className="absolute right-2 top-0 inline-flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
                    {totalCartItems > 99 ? "99+" : totalCartItems}
                  </span>
                ) : null}
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
