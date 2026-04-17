import type { Metadata } from "next";
import { SiteContactCard } from "@/components/site/site-contact-card";
import { getPublicSiteSettings } from "@/lib/services/public-settings-service";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description:
    "Read the Terms and Conditions for using Deal Bazaar, including ordering, payment, shipping, returns, and account rules.",
};

type Section = {
  id: string;
  title: string;
  paragraphs?: string[];
  bullets?: string[];
};

const sections: Section[] = [
  {
    id: "introduction",
    title: "1. Introduction",
    paragraphs: [
      "Welcome to Deal Bazaar. These Terms and Conditions govern your access to and use of our website, applications, products, and services.",
      "By visiting, browsing, registering, or placing an order on Deal Bazaar, you confirm that you have read, understood, and agree to be bound by these Terms and Conditions. If you do not agree, you must stop using the Website immediately.",
      "Deal Bazaar operates as a global e-commerce platform based in Sri Lanka, serving local and international customers where delivery is available.",
    ],
  },
  {
    id: "definitions",
    title: "2. Definitions",
    bullets: [
      '"Website" means the Deal Bazaar website, mobile interfaces, and related digital platforms.',
      '"Company" means Deal Bazaar, including its owners, management, employees, and authorized representatives.',
      '"User" means any person who accesses or uses the Website, whether registered or not.',
      '"Customer" means a User who places an order or attempts to purchase Products through the Website.',
      '"Products" means goods listed for sale on Deal Bazaar, including electronics, lifestyle items, gadgets, accessories, and related categories.',
      '"Services" means all services provided by Deal Bazaar, including ordering, payment processing support, delivery coordination, and customer support.',
    ],
  },
  {
    id: "eligibility",
    title: "3. Eligibility",
    paragraphs: [
      "You must be legally capable of entering into a binding contract under applicable law to use Deal Bazaar and place orders.",
      "You agree to provide true, accurate, current, and complete information for account creation, checkout, and delivery.",
      "We may refuse service or orders where eligibility requirements are not met.",
    ],
  },
  {
    id: "account-registration",
    title: "4. Account Registration",
    paragraphs: [
      "To access certain features, you may need to create an account. You are responsible for maintaining the confidentiality of your account credentials, including your password.",
      "You are fully responsible for all activities performed under your account. Please notify us immediately if you suspect unauthorized access or security issues.",
      "Deal Bazaar is not liable for losses resulting from your failure to protect account information.",
    ],
  },
  {
    id: "product-information",
    title: "5. Product Information",
    paragraphs: [
      "We aim to provide accurate product descriptions, images, availability, and specifications. However, minor variations in color, packaging, dimensions, or appearance may occur due to photography, display settings, and supplier updates.",
      "Product listings, technical details, and availability may be updated, corrected, or discontinued without prior notice.",
    ],
  },
  {
    id: "pricing-and-currency",
    title: "6. Pricing and Currency",
    paragraphs: [
      "Deal Bazaar supports multi-currency display for user convenience. Exchange rates may vary based on market conditions, payment provider rates, and bank processing terms.",
      "The final amount charged may differ slightly from displayed estimates due to conversion timing, processor fees, or issuer policies.",
      "Deal Bazaar reserves the right to correct pricing errors, typographical mistakes, or system errors at any time, including after an order is submitted.",
    ],
  },
  {
    id: "orders",
    title: "7. Orders",
    paragraphs: [
      "All orders are subject to acceptance, verification, and stock availability.",
      "Deal Bazaar may accept, reject, or cancel orders for reasons including but not limited to pricing errors, payment issues, stock limitations, risk checks, or suspected fraud.",
      "Order confirmation emails or messages acknowledge receipt of your request and do not guarantee final acceptance.",
    ],
  },
  {
    id: "payment-terms",
    title: "8. Payment Terms",
    bullets: [
      "Accepted payment methods are card payment and bank transfer.",
      "Cash on delivery is currently not active and is marked as coming soon.",
      "Orders are processed only after successful payment confirmation.",
      "For bank transfers, you may be required to submit payment proof, and processing begins after verification.",
    ],
  },
  {
    id: "shipping-and-delivery",
    title: "9. Shipping and Delivery",
    paragraphs: [
      "Deal Bazaar offers local and international shipping where available. Delivery times shown are estimates only and may vary by location, courier network, customs, public holidays, weather, or force majeure events.",
      "Customers are responsible for providing complete and accurate delivery information. Deal Bazaar is not responsible for delays or failed delivery caused by incorrect addresses or unavailable recipients.",
      "International orders may be subject to import duties, taxes, customs clearance, and local regulations, which are the responsibility of the Customer unless otherwise stated.",
    ],
  },
  {
    id: "returns-and-refunds",
    title: "10. Returns and Refunds",
    paragraphs: [
      "Return requests must be submitted within the return period specified on the product page or order confirmation.",
      "Items that are damaged on arrival, defective, or incorrect may be eligible for return, replacement, or refund after review.",
      "Refunds are processed to the original payment method, where possible, after returned items are inspected and approved.",
      "Shipping fees, payment processing fees, and currency conversion differences may be non-refundable unless required by law.",
    ],
    bullets: [
      "Non-returnable items may include personal care products, intimate items, perishable goods, customized products, digital goods, and products marked as non-returnable.",
      "Items must generally be returned unused, in original condition, and with original packaging where applicable.",
    ],
  },
  {
    id: "order-cancellation",
    title: "11. Order Cancellation",
    paragraphs: [
      "Customers may request cancellation before order processing or shipment. Once shipped, cancellation may not be possible and return procedures will apply.",
      "Deal Bazaar reserves the right to cancel any order at its discretion for operational, legal, security, or fraud-prevention reasons.",
      "If Deal Bazaar cancels an eligible paid order, a refund will be initiated according to the applicable refund process.",
    ],
  },
  {
    id: "user-responsibilities",
    title: "12. User Responsibilities",
    bullets: [
      "Use the Website lawfully and in good faith.",
      "Provide accurate account, payment, and delivery information.",
      "Do not place fraudulent, fake, or abusive orders.",
      "Comply with all applicable local and international laws.",
    ],
  },
  {
    id: "prohibited-activities",
    title: "13. Prohibited Activities",
    bullets: [
      "Attempting to hack, disrupt, reverse engineer, or compromise Website security.",
      "Scraping, automated data extraction, or unauthorized data mining.",
      "Posting fake reviews, harmful content, abusive comments, or misleading information.",
      "Using stolen payment instruments or engaging in fraud, money laundering, or illegal transactions.",
      "Uploading malware, viruses, bots, or code intended to damage systems or users.",
    ],
  },
  {
    id: "intellectual-property",
    title: "14. Intellectual Property",
    paragraphs: [
      "All content on Deal Bazaar, including logos, branding, text, layouts, graphics, product presentation, icons, and software elements, is owned by or licensed to Deal Bazaar and protected by intellectual property laws.",
      "No content may be copied, reproduced, distributed, republished, or commercially exploited without prior written permission from Deal Bazaar.",
    ],
  },
  {
    id: "third-party-services",
    title: "15. Third-Party Services",
    paragraphs: [
      "Deal Bazaar may rely on third-party service providers such as payment gateways, banks, courier companies, logistics providers, and external links.",
      "While we select providers carefully, Deal Bazaar does not fully control third-party systems and is not responsible for their independent actions, outages, errors, or policies.",
    ],
  },
  {
    id: "limitation-of-liability",
    title: "16. Limitation of Liability",
    paragraphs: [
      "To the maximum extent permitted by law, Deal Bazaar shall not be liable for indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, goodwill, or business opportunities.",
      "Deal Bazaar is not liable for delays, delivery interruptions, customs holds, payment processor downtime, or events beyond reasonable control.",
    ],
  },
  {
    id: "disclaimer",
    title: "17. Disclaimer",
    paragraphs: [
      'The Website and Services are provided on an "as is" and "as available" basis.',
      "Deal Bazaar does not guarantee uninterrupted access, error-free operation, or that all content is always complete, accurate, or up to date.",
    ],
  },
  {
    id: "privacy-policy-reference",
    title: "18. Privacy Policy Reference",
    paragraphs: [
      "Your personal data is collected, used, stored, and protected in accordance with the Deal Bazaar Privacy Policy.",
      "By using the Website, you also agree to the terms set out in our Privacy Policy.",
    ],
  },
  {
    id: "account-suspension",
    title: "19. Account Suspension",
    paragraphs: [
      "Deal Bazaar may suspend, restrict, or permanently terminate accounts that violate these Terms and Conditions, applicable laws, or security standards.",
      "We may also suspend accounts involved in suspicious activity, payment disputes, abuse, or fraudulent behavior.",
    ],
  },
  {
    id: "governing-law",
    title: "20. Governing Law",
    paragraphs: [
      "These Terms and Conditions shall be governed by and interpreted in accordance with the laws of Sri Lanka.",
      "Any disputes arising from these Terms shall be subject to the competent courts and legal authorities of Sri Lanka, unless mandatory consumer protection laws require otherwise.",
    ],
  },
  {
    id: "changes-to-terms",
    title: "21. Changes to Terms",
    paragraphs: [
      "Deal Bazaar may update or revise these Terms and Conditions at any time without prior notice.",
      "Updated versions become effective when published on the Website. Continued use of Deal Bazaar after updates means you accept the revised Terms.",
    ],
  },
  {
    id: "contact-information",
    title: "22. Contact Information",
    paragraphs: ["For questions about these Terms and Conditions, please contact Deal Bazaar:"],
  },
];

function withBrand(text: string, brandName: string) {
  return text.replaceAll("Deal Bazaar", brandName);
}

export const dynamic = "force-dynamic";

export default async function TermsPage() {
  const settings = await getPublicSiteSettings();

  return (
    <section className="space-y-6 rounded-2xl border border-border bg-card p-5 sm:p-7">
      <header className="space-y-3 border-b border-border pb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Legal
        </p>
        <h1 className="text-3xl font-bold sm:text-4xl">Terms &amp; Conditions</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
          {`These Terms and Conditions apply to all users of ${settings.siteName}. Please read this page carefully before using the Website or placing an order.`}
        </p>
        <p className="text-xs text-muted-foreground">Last updated: April 9, 2026</p>
      </header>

      <div className="grid gap-4 rounded-xl border border-border bg-background p-4 sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Business Name</p>
          <p className="mt-1 font-semibold">{settings.siteName}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Website Type</p>
          <p className="mt-1 font-semibold">Global E-commerce Store</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Payments</p>
          <p className="mt-1 font-semibold">Card Payment and Bank Transfer</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
            Cash on Delivery
          </p>
          <p className="mt-1 font-semibold">Coming soon</p>
        </div>
      </div>

      <div className="space-y-7">
        {sections.map((section) => (
          <article key={section.id} id={section.id} className="space-y-3 scroll-mt-24">
            <h2 className="text-xl font-bold sm:text-2xl">{section.title}</h2>

            {section.id === "contact-information" ? (
              <SiteContactCard
                className="rounded-xl border border-border bg-background p-4 sm:p-5"
                title="Contact"
                description={`For questions about these Terms and Conditions, please contact ${settings.siteName}:`}
              />
            ) : (
              <>
                {section.paragraphs?.map((paragraph, paragraphIndex) => (
                  <p
                    key={`${section.id}-paragraph-${paragraphIndex}`}
                    className="text-sm leading-7 text-muted-foreground sm:text-base"
                  >
                    {withBrand(paragraph, settings.siteName)}
                  </p>
                ))}

                {section.bullets ? (
                  <ul className="list-disc space-y-2 pl-5 text-sm leading-7 text-muted-foreground sm:text-base">
                    {section.bullets.map((bullet, bulletIndex) => (
                      <li key={`${section.id}-bullet-${bulletIndex}`}>
                        {withBrand(bullet, settings.siteName)}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
