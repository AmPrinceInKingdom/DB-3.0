export const siteConfig = {
  name: "Deal Bazaar",
  description:
    "Deal Bazaar is a modern multi-vendor marketplace for trusted deals, fast delivery, and a premium shopping experience.",
  url: "https://dealbazaar.com",
  supportEmail: "dealbazaar.pvt@gmail.com",
  supportPhone: "+94722493533",
  socialLinks: {
    facebook: "https://facebook.com/dealbazaar",
    instagram: "https://instagram.com/dealbazaar",
    linkedin: "https://linkedin.com/company/dealbazaar",
  },
  seo: {
    defaultOgImage: "/og-image.png",
  },
} as const;

export type SiteConfig = typeof siteConfig;
