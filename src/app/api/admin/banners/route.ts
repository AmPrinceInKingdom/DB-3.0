import { fail, ok } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/auth/admin-guard";
import { db } from "@/lib/db";
import { createBannerSchema } from "@/lib/validators/banner";

export async function GET() {
  const auth = await requireAdminSession();
  if (!auth.allowed) return auth.response;

  try {
    const banners = await db.banner.findMany({
      orderBy: [{ type: "asc" }, { position: "asc" }, { createdAt: "desc" }],
    });

    return ok(banners);
  } catch {
    return fail("Unable to fetch admin banners", 500, "ADMIN_BANNER_FETCH_FAILED");
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.allowed) return auth.response;

  try {
    const payload = createBannerSchema.parse(await request.json());
    const banner = await db.banner.create({
      data: {
        type: payload.type,
        title: payload.title,
        subtitle: payload.subtitle,
        imageUrl: payload.imageUrl,
        mobileImageUrl: payload.mobileImageUrl,
        ctaText: payload.ctaText,
        ctaUrl: payload.ctaUrl,
        position: payload.position,
        isActive: payload.isActive,
        startsAt: payload.startsAt,
        endsAt: payload.endsAt,
      },
    });

    return ok(banner, 201);
  } catch {
    return fail("Unable to create banner", 400, "BANNER_CREATE_FAILED");
  }
}

