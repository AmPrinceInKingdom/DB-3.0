import { ok, fail } from "@/lib/api-response";
import { db } from "@/lib/db";

type SuggestionItem = {
  id: string;
  name: string;
  slug: string;
  brand: string;
  category: string;
  imageUrl: string;
  price: number;
};

function normalizeQuery(raw: string | null) {
  return (raw ?? "").trim();
}

function normalizeLimit(raw: string | null) {
  const parsed = Number(raw ?? 6);
  if (!Number.isFinite(parsed)) return 6;
  return Math.min(Math.max(Math.floor(parsed), 1), 10);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = normalizeQuery(searchParams.get("q"));
    const limit = normalizeLimit(searchParams.get("limit"));

    if (query.length < 2) {
      return ok({
        query,
        items: [] as SuggestionItem[],
      });
    }

    const dbSuggestions = await db.product.findMany({
      where: {
        status: "ACTIVE",
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { shortDescription: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
          { brand: { name: { contains: query, mode: "insensitive" } } },
          { category: { name: { contains: query, mode: "insensitive" } } },
        ],
      },
      select: {
        id: true,
        slug: true,
        name: true,
        currentPrice: true,
        brand: {
          select: {
            name: true,
          },
        },
        category: {
          select: {
            name: true,
          },
        },
        images: {
          where: { isMain: true },
          select: { imageUrl: true },
          take: 1,
        },
      },
      orderBy: [{ popularityScore: "desc" }, { createdAt: "desc" }],
      take: limit,
    });

    const items: SuggestionItem[] = dbSuggestions.map((item) => ({
      id: item.id,
      name: item.name,
      slug: item.slug,
      brand: item.brand?.name ?? "Deal Bazaar",
      category: item.category.name,
      imageUrl: item.images[0]?.imageUrl ?? "",
      price: Number(item.currentPrice),
    }));

    return ok({
      query,
      items,
    });
  } catch {
    return fail("Unable to fetch search suggestions", 500, "SEARCH_SUGGESTIONS_FAILED");
  }
}
