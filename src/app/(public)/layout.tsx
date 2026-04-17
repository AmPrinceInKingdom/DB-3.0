import type { ReactNode } from "react";
import { MainFooter } from "@/components/layout/main-footer";
import { MainHeader } from "@/components/layout/main-header";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";

type Props = {
  children: ReactNode;
};

export default function PublicLayout({ children }: Props) {
  return (
    <div className="min-h-screen">
      <MainHeader />
      <main className="container-app py-6 pb-24 lg:pb-8">{children}</main>
      <MainFooter />
      <MobileBottomNav />
    </div>
  );
}
