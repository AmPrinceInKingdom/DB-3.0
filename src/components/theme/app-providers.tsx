"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { AccountCollectionsSyncBridge } from "@/components/collections/account-collections-sync-bridge";
import { SavedCartSyncBridge } from "@/components/cart/saved-cart-sync-bridge";
import { ToastViewport } from "@/components/ui/toast-viewport";

type Props = {
  children: ReactNode;
};

export function AppProviders({ children }: Props) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
      <SavedCartSyncBridge />
      <AccountCollectionsSyncBridge />
      <ToastViewport />
    </ThemeProvider>
  );
}
