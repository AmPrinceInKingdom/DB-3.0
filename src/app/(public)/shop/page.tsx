import Link from "next/link";
import { ProductCard } from "@/components/home/product-card";
import { getShopFilterOptions, listProducts } from "@/lib/services/product-service";
import { Badge } from "@/components/ui/badge";

type ShopParams = {
  q?: string;
  sort?: string;
  category?: string;
  brand?: string;
  inStock?: string;
  featured?: string;
  newArrivals?: string;
  bestSellers?: string;
  minPrice?: string;
  maxPrice?: string;
};

type Props = {
  searchParams: Promise<ShopParams>;
};

type SortValue = "popular" | "price_asc" | "price_desc" | "newest" | "best_selling" | "highest_rated";

const sortOptions: Array<{ value: SortValue; label: string }> = [
  { value: "popular", label: "Most Popular" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "newest", label: "Newest" },
  { value: "best_selling", label: "Best Selling" },
  { value: "highest_rated", label: "Highest Rated" },
];

function normalizeText(value?: string) {
  return value?.trim() ?? "";
}

function normalizeToken(value?: string) {
  return normalizeText(value).toLowerCase();
}

function parseFlag(value?: string) {
  const normalized = normalizeToken(value);
  return normalized === "1" || normalized === "true" || normalized === "on";
}

function parsePositiveNumber(value?: string) {
  const raw = normalizeText(value);
  if (!raw) return undefined;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return parsed;
}

function parseSort(value?: string): SortValue {
  const normalized = normalizeToken(value);
  return sortOptions.some((item) => item.value === normalized)
    ? (normalized as SortValue)
    : "popular";
}

export default async function ShopPage({ searchParams }: Props) {
  const params = await searchParams;
  const searchText = normalizeText(params.q);
  const query = searchText.toLowerCase();
  const selectedSort = parseSort(params.sort);
  const selectedCategory = normalizeToken(params.category);
  const selectedBrand = normalizeToken(params.brand);
  const minPrice = parsePositiveNumber(params.minPrice);
  const maxPrice = parsePositiveNumber(params.maxPrice);
  const filterInStock = parseFlag(params.inStock);
  const filterFeatured = parseFlag(params.featured);
  const filterNewArrivals = parseFlag(params.newArrivals);
  const filterBestSellers = parseFlag(params.bestSellers);

  const [{ categories, brands }, visibleProducts] = await Promise.all([
    getShopFilterOptions(),
    listProducts({
      search: query || undefined,
      categoryName: selectedCategory || undefined,
      brandName: selectedBrand || undefined,
      minPrice,
      maxPrice,
      inStock: filterInStock,
      featured: filterFeatured,
      newArrival: filterNewArrivals,
      bestSeller: filterBestSellers,
      sortBy: selectedSort,
    }),
  ]);

  const hasActiveFilters =
    Boolean(searchText) ||
    Boolean(selectedCategory) ||
    Boolean(selectedBrand) ||
    minPrice !== undefined ||
    maxPrice !== undefined ||
    filterInStock ||
    filterFeatured ||
    filterNewArrivals ||
    filterBestSellers ||
    selectedSort !== "popular";
  const activeFilterCount = [
    Boolean(searchText),
    Boolean(selectedCategory),
    Boolean(selectedBrand),
    minPrice !== undefined,
    maxPrice !== undefined,
    filterInStock,
    filterFeatured,
    filterNewArrivals,
    filterBestSellers,
    selectedSort !== "popular",
  ].filter(Boolean).length;

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-border bg-card p-5">
        <h1 className="text-2xl font-bold">Shop</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Discover products with advanced filtering, sorting, and multi-currency ready pricing.
        </p>
        {hasActiveFilters ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {searchText ? <Badge className="text-xs">Search: {searchText}</Badge> : null}
            <Badge className="bg-muted text-xs text-foreground">
              {visibleProducts.length} products found
            </Badge>
            <Link href="/shop" className="text-xs font-semibold text-primary hover:text-primary/80">
              Clear all filters
            </Link>
          </div>
        ) : null}
      </header>

      <section className="rounded-2xl border border-border bg-card p-4">
        <details className="group" open={hasActiveFilters}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3 [&::-webkit-details-marker]:hidden">
            <div>
              <p className="text-sm font-semibold">Filter & Sort Products</p>
              <p className="text-xs text-muted-foreground">
                Open this panel only when you need advanced filters.
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold text-primary">
                {activeFilterCount > 0 ? `${activeFilterCount} active` : "No active filters"}
              </p>
              <p className="text-xs text-muted-foreground group-open:hidden">Tap to open</p>
              <p className="hidden text-xs text-muted-foreground group-open:block">Tap to close</p>
            </div>
          </summary>

          <form method="GET" action="/shop" className="mt-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <label className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Search</span>
                <input
                  name="q"
                  defaultValue={searchText}
                  placeholder="Search products"
                  className="focus-ring h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Category</span>
                <select
                  name="category"
                  defaultValue={selectedCategory}
                  className="focus-ring h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                >
                  <option value="">All categories</option>
                  {categories.map((category) => (
                    <option key={category} value={category.toLowerCase()}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Brand</span>
                <select
                  name="brand"
                  defaultValue={selectedBrand}
                  className="focus-ring h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                >
                  <option value="">All brands</option>
                  {brands.map((brand) => (
                    <option key={brand} value={brand.toLowerCase()}>
                      {brand}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Min Price</span>
                <input
                  type="number"
                  name="minPrice"
                  min={0}
                  step="0.01"
                  defaultValue={minPrice}
                  placeholder="0"
                  className="focus-ring h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Max Price</span>
                <input
                  type="number"
                  name="maxPrice"
                  min={0}
                  step="0.01"
                  defaultValue={maxPrice}
                  placeholder="Any"
                  className="focus-ring h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <label className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Sort By</span>
                <select
                  name="sort"
                  defaultValue={selectedSort}
                  className="focus-ring h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                >
                  {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex flex-wrap gap-2">
                <label className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs">
                  <input type="checkbox" name="inStock" value="1" defaultChecked={filterInStock} />
                  In stock
                </label>
                <label className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs">
                  <input type="checkbox" name="featured" value="1" defaultChecked={filterFeatured} />
                  Featured
                </label>
                <label className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs">
                  <input
                    type="checkbox"
                    name="newArrivals"
                    value="1"
                    defaultChecked={filterNewArrivals}
                  />
                  New arrivals
                </label>
                <label className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs">
                  <input
                    type="checkbox"
                    name="bestSellers"
                    value="1"
                    defaultChecked={filterBestSellers}
                  />
                  Best sellers
                </label>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
              >
                Apply Filters
              </button>
              <Link
                href="/shop"
                className="inline-flex rounded-lg border border-border px-4 py-2 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
              >
                Reset
              </Link>
            </div>
          </form>
        </details>
      </section>

      {visibleProducts.length > 0 ? (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {visibleProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </section>
      ) : (
        <section className="rounded-2xl border border-border bg-card p-8 text-center">
          <h2 className="text-xl font-semibold">No products matched your filters</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Try a wider price range or remove some filters.
          </p>
          <Link
            href="/shop"
            className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            View All Products
          </Link>
        </section>
      )}
    </div>
  );
}
