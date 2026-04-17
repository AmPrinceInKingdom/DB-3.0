import Link from "next/link";
import { featuredCategories } from "@/lib/constants/mock-data";

export function CategoryChips() {
  return (
    <section>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold md:text-2xl">Featured Categories</h2>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {featuredCategories.map((category) => (
          <Link
            key={category}
            href={`/shop?category=${encodeURIComponent(category)}`}
            className="rounded-xl border border-border bg-card px-3 py-4 text-center text-sm font-medium transition hover:border-primary/50 hover:bg-muted"
          >
            {category}
          </Link>
        ))}
      </div>
    </section>
  );
}
