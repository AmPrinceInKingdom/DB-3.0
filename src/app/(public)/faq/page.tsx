import type { Metadata } from "next";
import { SiteContactCard } from "@/components/site/site-contact-card";
import { getPublicSiteSettings } from "@/lib/services/public-settings-service";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Find answers to common questions about ordering, payments, shipping, returns, products, and account support at Deal Bazaar.",
};

type FaqItem = {
  question: string;
  answer: string;
};

type FaqSection = {
  title: string;
  items: FaqItem[];
};

const faqSections: FaqSection[] = [
  {
    title: "General Questions",
    items: [
      {
        question: "What is Deal Bazaar?",
        answer:
          "Deal Bazaar is an online store offering electronics, gadgets, lifestyle products, accessories, and other general items for customers worldwide.",
      },
      {
        question: "How does Deal Bazaar work?",
        answer:
          "You can browse products, add items to your cart, complete secure checkout, and receive updates until your order is delivered.",
      },
      {
        question: "Do I need an account to place an order?",
        answer:
          "Creating an account is recommended for easier order tracking and faster future checkout, but availability of guest checkout may vary by region.",
      },
      {
        question: "Is Deal Bazaar available worldwide?",
        answer:
          "Yes, Deal Bazaar serves global customers. Local and international shipping is available where service coverage exists.",
      },
    ],
  },
  {
    title: "Orders",
    items: [
      {
        question: "How do I place an order?",
        answer:
          "Select your product, choose options if available, add to cart, enter shipping details, choose payment, and confirm the order.",
      },
      {
        question: "Can I cancel my order?",
        answer:
          "Yes, you can request cancellation before shipment. Once dispatched, cancellation may not be possible and return policy rules will apply.",
      },
      {
        question: "How can I track my order?",
        answer:
          "You can track your order from your account order history or through shipment updates sent by email or SMS where available.",
      },
      {
        question: "What happens after I place an order?",
        answer:
          "After placement, we verify payment, confirm stock, prepare the package, and share shipping or delivery progress updates.",
      },
    ],
  },
  {
    title: "Payments",
    items: [
      {
        question: "What payment methods do you accept?",
        answer: "We currently accept card payment and bank transfer.",
      },
      {
        question: "Is card payment secure?",
        answer:
          "Yes. Card payments are processed through secure payment providers using standard encryption and fraud protection controls.",
      },
      {
        question: "Do you offer cash on delivery?",
        answer:
          "Cash on delivery is not active yet. It is planned and currently marked as coming soon.",
      },
      {
        question: "When is my order confirmed?",
        answer:
          "Your order is confirmed after successful payment verification and final stock validation.",
      },
    ],
  },
  {
    title: "Shipping & Delivery",
    items: [
      {
        question: "How long does delivery take?",
        answer:
          "Delivery times depend on destination and shipping method. Estimated delivery windows are shown during checkout.",
      },
      {
        question: "Do you ship internationally?",
        answer:
          "Yes. International shipping is available for selected countries and products based on logistics support.",
      },
      {
        question: "What if my order is delayed?",
        answer:
          "Occasional delays may happen due to courier operations, customs clearance, weather, or holidays. We will keep you informed if delays occur.",
      },
      {
        question: "What if I entered the wrong address?",
        answer:
          "Contact support immediately. If the order has not shipped, we can help update the address. After dispatch, changes may be limited.",
      },
    ],
  },
  {
    title: "Returns & Refunds",
    items: [
      {
        question: "Can I return a product?",
        answer:
          "Yes, eligible items can be returned within the allowed return period based on our return policy conditions.",
      },
      {
        question: "When will I receive my refund?",
        answer:
          "Refund timing depends on inspection and your payment method. Approved refunds are usually processed within standard banking timelines.",
      },
      {
        question: "What if I receive a damaged item?",
        answer:
          "Please contact us quickly with photos and order details. Damaged or incorrect items are eligible for review and support.",
      },
      {
        question: "Are all products returnable?",
        answer:
          "No. Some categories may be non-returnable for hygiene, safety, or product-type reasons. Please check product-specific return notes.",
      },
    ],
  },
  {
    title: "Products",
    items: [
      {
        question: "Are products original and high quality?",
        answer:
          "We focus on quality and trusted sourcing. Product quality checks and listing standards are continuously monitored.",
      },
      {
        question: "Why do product prices change?",
        answer:
          "Prices may change due to promotions, supplier updates, stock movement, and currency conversion factors in a multi-currency environment.",
      },
      {
        question: "Are images exactly same as product?",
        answer:
          "We aim for accurate images, but slight differences in color or appearance may occur due to lighting, packaging, or screen settings.",
      },
      {
        question: "What if product is out of stock?",
        answer:
          "Out-of-stock items may be restocked later. You can check back or contact support for availability updates.",
      },
    ],
  },
  {
    title: "Account & Support",
    items: [
      {
        question: "How do I contact Deal Bazaar?",
        answer:
          "You can contact us by email or phone. Full support details are listed in the contact section below.",
      },
      {
        question: "How do I change my account details?",
        answer:
          "Sign in to your account and update profile details from your account settings page.",
      },
      {
        question: "I forgot my password, what should I do?",
        answer:
          "Use the Forgot Password option on the login page and follow the reset instructions sent to your registered email.",
      },
      {
        question: "How do I report a problem?",
        answer:
          "Please contact support with your order number and issue details. Our team will review and assist as quickly as possible.",
      },
    ],
  },
];

function withBrand(text: string, brandName: string) {
  return text.replaceAll("Deal Bazaar", brandName);
}

export const dynamic = "force-dynamic";

export default async function FaqPage() {
  const settings = await getPublicSiteSettings();

  return (
    <section className="space-y-6 rounded-2xl border border-border bg-card p-5 sm:p-7">
      <header className="space-y-3 border-b border-border pb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Help Center
        </p>
        <h1 className="text-3xl font-bold sm:text-4xl">Frequently Asked Questions</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
          {`Quick answers to common questions about shopping on ${settings.siteName}.`}
        </p>
      </header>

      <div className="grid gap-4 rounded-xl border border-border bg-background p-4 sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Business Name</p>
          <p className="mt-1 font-semibold">{settings.siteName}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Payments</p>
          <p className="mt-1 font-semibold">Card Payment and Bank Transfer</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Cash on Delivery</p>
          <p className="mt-1 font-semibold">Coming soon</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Currency</p>
          <p className="mt-1 font-semibold">Multi-currency supported</p>
        </div>
      </div>

      <div className="space-y-8">
        {faqSections.map((section) => (
          <article key={section.title} className="space-y-3">
            <h2 className="text-xl font-bold sm:text-2xl">{section.title}</h2>
            <div className="space-y-2">
              {section.items.map((item) => (
                <details
                  key={item.question}
                  className="group rounded-xl border border-border bg-background p-4"
                >
                  <summary className="cursor-pointer list-none pr-4 text-sm font-semibold sm:text-base">
                    {withBrand(item.question, settings.siteName)}
                  </summary>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground sm:text-base">
                    {withBrand(item.answer, settings.siteName)}
                  </p>
                </details>
              ))}
            </div>
          </article>
        ))}
      </div>

      <SiteContactCard
        className="rounded-xl border border-border bg-background p-4 sm:p-5"
        title="Contact"
        description={`Need more help? Reach out to ${settings.siteName} support team:`}
      />
    </section>
  );
}
