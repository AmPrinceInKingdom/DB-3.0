import type { Metadata } from "next";
import { SiteContactCard } from "@/components/site/site-contact-card";

export const metadata: Metadata = {
  title: "Contact Us",
  description: "Get in touch with Deal Bazaar support, business, and seller onboarding teams.",
};

export default function ContactPage() {
  return (
    <section className="space-y-6 rounded-2xl border border-border bg-card p-5 sm:p-7">
      <header className="space-y-3 border-b border-border pb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Contact Deal Bazaar
        </p>
        <h1 className="text-3xl font-bold sm:text-4xl">We Are Here to Help</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
          Reach our support, business, or seller onboarding team for any order question, product
          inquiry, or partnership request.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <article className="rounded-xl border border-border bg-background p-4">
          <h2 className="text-lg font-bold">Customer Support</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Help with orders, payments, returns, refunds, and delivery issues.
          </p>
        </article>
        <article className="rounded-xl border border-border bg-background p-4">
          <h2 className="text-lg font-bold">Business & Partnerships</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Contact us for vendor onboarding, collaborations, and marketplace opportunities.
          </p>
        </article>
      </div>

      <SiteContactCard
        className="rounded-xl border border-border bg-background p-4 sm:p-5"
        title="Support Details"
      />
    </section>
  );
}
