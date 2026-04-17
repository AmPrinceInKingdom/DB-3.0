import type { Metadata } from "next";
import { SiteContactCard } from "@/components/site/site-contact-card";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "Learn about Deal Bazaar, our mission, vision, product range, and commitment to customers worldwide.",
};

export default function AboutPage() {
  return (
    <section className="space-y-6 rounded-2xl border border-border bg-card p-5 sm:p-7">
      <header className="space-y-3 border-b border-border pb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          About Deal Bazaar
        </p>
        <h1 className="text-3xl font-bold sm:text-4xl">Built for Better Online Shopping</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
          Deal Bazaar is a modern e-commerce store created to make online shopping simple, reliable,
          and accessible for customers around the world.
        </p>
      </header>

      <article className="space-y-3">
        <h2 className="text-xl font-bold sm:text-2xl">Introduction</h2>
        <p className="text-sm leading-7 text-muted-foreground sm:text-base">
          Welcome to Deal Bazaar. We provide a trusted online shopping platform where customers can
          discover quality products at fair prices. From everyday essentials to trending gadgets,
          our goal is to help you shop with confidence, wherever you are.
        </p>
      </article>

      <article className="space-y-3">
        <h2 className="text-xl font-bold sm:text-2xl">Who We Are</h2>
        <p className="text-sm leading-7 text-muted-foreground sm:text-base">
          Deal Bazaar is an online store focused on quality, affordability, and convenience. We are
          committed to creating a smooth digital shopping experience through secure checkout, clear
          product information, and dependable service for local and international buyers.
        </p>
      </article>

      <article className="space-y-3">
        <h2 className="text-xl font-bold sm:text-2xl">What We Offer</h2>
        <p className="text-sm leading-7 text-muted-foreground sm:text-base">
          We offer a wide selection of products, including electronics, gadgets, lifestyle items,
          accessories, and other general categories. Our catalog is regularly updated with new
          arrivals, popular picks, and trending items to give customers more value and choice in one
          place.
        </p>
      </article>

      <article className="space-y-3">
        <h2 className="text-xl font-bold sm:text-2xl">Mission</h2>
        <p className="text-sm leading-7 text-muted-foreground sm:text-base">
          Our mission is to deliver a reliable and simple shopping experience that gives customers
          real value through quality products, secure payment options, and responsive support.
        </p>
      </article>

      <article className="space-y-3">
        <h2 className="text-xl font-bold sm:text-2xl">Vision</h2>
        <p className="text-sm leading-7 text-muted-foreground sm:text-base">
          Our vision is to grow Deal Bazaar into a globally recognized online marketplace trusted for
          convenience, transparency, and customer satisfaction.
        </p>
      </article>

      <article className="space-y-3">
        <h2 className="text-xl font-bold sm:text-2xl">Why Choose Deal Bazaar</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-7 text-muted-foreground sm:text-base">
          <li>Quality products</li>
          <li>Competitive pricing</li>
          <li>Secure payments (card payment and bank transfer)</li>
          <li>Easy shopping experience</li>
          <li>Multi-currency support</li>
          <li>Global availability where shipping is supported</li>
          <li>Customer support that listens and helps</li>
        </ul>
      </article>

      <article className="space-y-3">
        <h2 className="text-xl font-bold sm:text-2xl">Our Commitment</h2>
        <p className="text-sm leading-7 text-muted-foreground sm:text-base">
          We continuously improve our platform, product selection, and service standards to meet the
          needs of modern shoppers. Every update we make is guided by a customer-first approach so
          that Deal Bazaar remains dependable, user-friendly, and ready for long-term growth.
        </p>
      </article>

      <SiteContactCard className="rounded-xl border border-border bg-background p-4 sm:p-5" />
    </section>
  );
}
