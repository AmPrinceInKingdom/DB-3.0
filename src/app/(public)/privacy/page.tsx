import type { Metadata } from "next";
import { SiteContactCard } from "@/components/site/site-contact-card";
import { getPublicSiteSettings } from "@/lib/services/public-settings-service";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Read how Deal Bazaar collects, uses, protects, and manages personal information for global customers.",
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
      "Deal Bazaar values your privacy and is committed to protecting your personal information.",
      "This Privacy Policy explains how we collect, use, share, and protect your information when you visit our Website or use our services.",
      "By using Deal Bazaar, you agree to the practices described in this Privacy Policy.",
    ],
  },
  {
    id: "information-we-collect",
    title: "2. Information We Collect",
    paragraphs: [
      "To provide our e-commerce services, we may collect the following information:",
    ],
    bullets: [
      "Name",
      "Email address",
      "Phone number",
      "Shipping address",
      "Billing information",
      "Order details",
      "Payment information (processed securely through third-party payment providers)",
      "IP address",
      "Device and browser information",
    ],
  },
  {
    id: "how-we-use-information",
    title: "3. How We Use Your Information",
    paragraphs: ["We use your information to:"],
    bullets: [
      "Process and manage orders",
      "Deliver products and coordinate shipping",
      "Provide customer support",
      "Improve Website performance and shopping experience",
      "Send service updates, order notifications, and relevant communications",
      "Prevent fraud, abuse, and unauthorized activity",
      "Respond to your inquiries and communicate with you",
    ],
  },
  {
    id: "payment-information",
    title: "4. Payment Information",
    paragraphs: [
      "Deal Bazaar accepts card payment and bank transfer. Cash on delivery is currently coming soon.",
      "Payments are handled by secure third-party payment providers and financial channels.",
      "Deal Bazaar does not store full card details such as complete card numbers, CVV, or card PIN data.",
    ],
  },
  {
    id: "cookies",
    title: "5. Cookies and Tracking Technologies",
    paragraphs: [
      "We use cookies and similar technologies to improve your experience on Deal Bazaar.",
      "These technologies help us with:",
    ],
    bullets: [
      "Login sessions",
      "Cart saving",
      "Analytics and performance tracking",
      "Language and currency preferences",
      "Improving user experience and Website functionality",
    ],
  },
  {
    id: "sharing-information",
    title: "6. Sharing Your Information",
    paragraphs: [
      "We do not sell your personal data. We may share your information only when necessary with trusted service providers and authorities, including:",
    ],
    bullets: [
      "Payment providers",
      "Shipping and logistics partners",
      "Analytics and technical service providers",
      "Legal authorities when required by law, court order, or regulatory process",
    ],
  },
  {
    id: "data-security",
    title: "7. Data Security",
    paragraphs: [
      "Deal Bazaar uses reasonable administrative, technical, and organizational safeguards to protect your personal information against unauthorized access, loss, misuse, or disclosure.",
      "Although we apply strong security practices, no online platform can guarantee absolute security.",
    ],
  },
  {
    id: "data-retention",
    title: "8. Data Retention",
    paragraphs: [
      "We retain personal information only as long as necessary to provide services, complete orders, resolve disputes, enforce agreements, and meet legal, tax, and regulatory obligations.",
      "When data is no longer required, we take reasonable steps to delete or anonymize it.",
    ],
  },
  {
    id: "your-rights",
    title: "9. Your Rights",
    paragraphs: ["Depending on applicable law, you may request to:"],
    bullets: [
      "Access your personal data",
      "Correct inaccurate or incomplete information",
      "Request deletion of your data, subject to legal obligations",
      "Opt out of marketing or non-essential communications",
    ],
  },
  {
    id: "third-party-links",
    title: "10. Third-Party Links",
    paragraphs: [
      "Our Website may include links to third-party websites or services.",
      "Deal Bazaar is not responsible for the privacy practices, content, or policies of third-party websites.",
    ],
  },
  {
    id: "childrens-privacy",
    title: "11. Children's Privacy",
    paragraphs: [
      "Deal Bazaar is not intended for children under the applicable legal age in their jurisdiction.",
      "We do not knowingly collect personal information from children without lawful consent.",
    ],
  },
  {
    id: "international-users",
    title: "12. International Users",
    paragraphs: [
      "Deal Bazaar serves customers worldwide. Your information may be processed, transferred, and stored in different regions where we or our service providers operate.",
      "By using our services, you understand and agree to this cross-border data processing, subject to applicable data protection laws.",
    ],
  },
  {
    id: "changes-to-policy",
    title: "13. Changes to Privacy Policy",
    paragraphs: [
      "Deal Bazaar may update this Privacy Policy at any time to reflect legal, operational, or service changes.",
      "Updated versions become effective when posted on this page. Continued use of the Website after updates means you accept the revised policy.",
    ],
  },
  {
    id: "contact-information",
    title: "14. Contact Information",
    paragraphs: ["If you have any questions about this Privacy Policy or your data, please contact us:"],
  },
];

function withBrand(text: string, brandName: string) {
  return text.replaceAll("Deal Bazaar", brandName);
}

export const dynamic = "force-dynamic";

export default async function PrivacyPolicyPage() {
  const settings = await getPublicSiteSettings();

  return (
    <section className="space-y-6 rounded-2xl border border-border bg-card p-5 sm:p-7">
      <header className="space-y-3 border-b border-border pb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Legal
        </p>
        <h1 className="text-3xl font-bold sm:text-4xl">Privacy Policy</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
          {`This Privacy Policy explains how ${settings.siteName} handles personal information for customers using our global e-commerce platform.`}
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
          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Currency</p>
          <p className="mt-1 font-semibold">Multi-currency supported</p>
        </div>
      </div>

      <div className="space-y-7">
        {sections.map((section) => (
          <article key={section.id} id={section.id} className="space-y-3 scroll-mt-24">
            <h2 className="text-xl font-bold sm:text-2xl">{section.title}</h2>

            {section.id === "contact-information" ? (
              <SiteContactCard
                className="rounded-xl border border-border bg-background p-4 sm:p-5"
                title="Contact Information"
                description={`If you have any questions about this Privacy Policy or your data, please contact ${settings.siteName}:`}
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
