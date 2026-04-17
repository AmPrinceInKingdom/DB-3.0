export type BannerItem = {
  id: string;
  type: "HERO" | "PROMOTION" | "CATEGORY" | "FLASH_DEAL";
  title: string;
  subtitle: string | null;
  imageUrl: string;
  mobileImageUrl: string | null;
  ctaText: string | null;
  ctaUrl: string | null;
  position: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
};

