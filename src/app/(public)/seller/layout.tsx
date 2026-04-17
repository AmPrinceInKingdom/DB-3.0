import type { ReactNode } from "react";
import { sellerNavItems } from "@/lib/constants/navigation";
import { LogoutButton } from "@/components/auth/logout-button";
import { PanelNav } from "@/components/layout/panel-nav";
import { PanelShell } from "@/components/layout/panel-shell";

type Props = {
  children: ReactNode;
};

export default function SellerLayout({ children }: Props) {
  return (
    <PanelShell
      sideTitle="Seller Center"
      nav={<PanelNav items={sellerNavItems} />}
      headerEyebrow="Seller Workspace"
      headerTitle="Manage products, orders, payouts, and store profile from one place"
      headerAction={<LogoutButton variant="danger" />}
      sidebarClassName="lg:grid-cols-[250px_1fr]"
      containerClassName="py-2 pb-4"
    >
      {children}
    </PanelShell>
  );
}
