import { BannerType } from "@prisma/client";
import { ok, fail } from "@/lib/api-response";
import { db } from "@/lib/db";

const bannerTypes = new Set<string>(Object.values(BannerType));

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const typeParam = searchParams.get("type");
    const includeInactive = searchParams.get("includeInactive") === "true";
    const limitParam = Number(searchParams.get("limit") ?? 8);
    const limit = Number.isNaN(limitParam) ? 8 : Math.min(Math.max(limitParam, 1), 20);
    const now = new Date();

    const type =
      typeParam && bannerTypes.has(typeParam)
        ? (typeParam as BannerType)
        : undefined;

    const banners = await db.banner.findMany({
      where: {
        ...(type ? { type } : {}),
        ...(includeInactive ? {} : { isActive: true }),
        ...(includeInactive
          ? {}
          : {
              AND: [
                {
                  OR: [{ startsAt: null }, { startsAt: { lte: now } }],
                },
                {
                  OR: [{ endsAt: null }, { endsAt: { gte: now } }],
                },
              ],
            }),
      },
      orderBy: [{ position: "asc" }, { createdAt: "desc" }],
      take: limit,
    });

    return ok(banners);
  } catch {
    return fail("Unable to fetch banners", 500, "BANNER_FETCH_FAILED");
  }
}

