import { BannerType } from "@prisma/client";
import { z } from "zod";

const textField = z.string().trim();
const optionalText = textField.max(320).optional().or(z.literal(""));
const optionalUrl = z.url().optional().or(z.literal(""));
const optionalDateString = z.string().trim().optional().or(z.literal(""));

function normalizeText(value?: string) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeDate(value?: string) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const bannerCreateBaseSchema = z.object({
  type: z.nativeEnum(BannerType).default(BannerType.HERO),
  title: textField.min(2).max(180),
  subtitle: optionalText,
  imageUrl: z.url(),
  mobileImageUrl: optionalUrl,
  ctaText: textField.max(80).optional().or(z.literal("")),
  ctaUrl: optionalUrl,
  position: z.coerce.number().int().min(0).default(0),
  isActive: z.coerce.boolean().default(true),
  startsAt: optionalDateString,
  endsAt: optionalDateString,
});

export const createBannerSchema = bannerCreateBaseSchema.transform((value) => ({
  type: value.type,
  title: value.title,
  subtitle: normalizeText(value.subtitle),
  imageUrl: value.imageUrl,
  mobileImageUrl: normalizeText(value.mobileImageUrl),
  ctaText: normalizeText(value.ctaText),
  ctaUrl: normalizeText(value.ctaUrl),
  position: value.position,
  isActive: value.isActive,
  startsAt: normalizeDate(value.startsAt),
  endsAt: normalizeDate(value.endsAt),
}));

export const updateBannerSchema = z.object({
  type: z.nativeEnum(BannerType).optional(),
  title: textField.min(2).max(180).optional(),
  subtitle: optionalText,
  imageUrl: z.url().optional(),
  mobileImageUrl: optionalUrl,
  ctaText: textField.max(80).optional().or(z.literal("")),
  ctaUrl: optionalUrl,
  position: z.coerce.number().int().min(0).optional(),
  isActive: z.coerce.boolean().optional(),
  startsAt: optionalDateString,
  endsAt: optionalDateString,
});

export function normalizeOptionalBannerUpdate(payload: z.infer<typeof updateBannerSchema>) {
  return {
    ...(payload.type !== undefined ? { type: payload.type } : {}),
    ...(payload.title !== undefined ? { title: payload.title } : {}),
    ...(payload.subtitle !== undefined ? { subtitle: normalizeText(payload.subtitle) } : {}),
    ...(payload.imageUrl !== undefined ? { imageUrl: payload.imageUrl } : {}),
    ...(payload.mobileImageUrl !== undefined
      ? { mobileImageUrl: normalizeText(payload.mobileImageUrl) }
      : {}),
    ...(payload.ctaText !== undefined ? { ctaText: normalizeText(payload.ctaText) } : {}),
    ...(payload.ctaUrl !== undefined ? { ctaUrl: normalizeText(payload.ctaUrl) } : {}),
    ...(payload.position !== undefined ? { position: payload.position } : {}),
    ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
    ...(payload.startsAt !== undefined ? { startsAt: normalizeDate(payload.startsAt) } : {}),
    ...(payload.endsAt !== undefined ? { endsAt: normalizeDate(payload.endsAt) } : {}),
  };
}

export type CreateBannerInput = z.infer<typeof createBannerSchema>;
export type UpdateBannerInput = z.infer<typeof updateBannerSchema>;

