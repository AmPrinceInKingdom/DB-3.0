import { MiniProductCard } from "@/components/home/mini-product-card";
import { SectionHeader } from "@/components/home/section-header";
import type { Product } from "@/types/product";

type Props = {
  title: string;
  subtitle: string;
  href: string;
  products: Product[];
};

export function ProductStripSection({ title, subtitle, href, products }: Props) {
  if (products.length === 0) return null;

  return (
    <section>
      <SectionHeader title={title} subtitle={subtitle} href={href} />
      <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {products.map((product) => (
          <div
            key={`${title}-${product.id}`}
            className="min-w-[160px] max-w-[160px] sm:min-w-[175px] sm:max-w-[175px]"
          >
            <MiniProductCard product={product} />
          </div>
        ))}
      </div>
    </section>
  );
}
