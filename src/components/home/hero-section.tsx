import Link from "next/link";
import { ArrowRight, ShieldCheck, Truck, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const trustItems = [
  { label: "Secure Payments", icon: WalletCards },
  { label: "Trusted Sellers", icon: ShieldCheck },
  { label: "Fast Delivery", icon: Truck },
];

export function HeroSection() {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 md:p-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(189,16,38,0.14),transparent_45%),radial-gradient(circle_at_80%_0,rgba(0,0,0,0.09),transparent_38%)]" />
      <div className="relative z-10 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <Badge>Seasonal Mega Offers</Badge>
          <h1 className="mt-4 text-3xl font-bold leading-tight md:text-5xl">
            Smart Deals. Trusted Brands. One Premium Marketplace.
          </h1>
          <p className="mt-4 max-w-2xl text-sm text-muted-foreground md:text-base">
            Deal Bazaar brings curated products, clean checkout, secure payment
            options, and admin-grade order control in one scalable platform.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button asChild className="h-11 px-6">
              <Link href="/shop">
                Start Shopping <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" asChild className="h-11 px-6">
              <Link href="/offers">View Hot Deals</Link>
            </Button>
          </div>
        </div>
        <div className="rounded-2xl border border-border/80 bg-background/75 p-5">
          <p className="text-sm font-semibold">Why customers choose us</p>
          <ul className="mt-4 space-y-3">
            {trustItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.label} className="flex items-center gap-3">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
