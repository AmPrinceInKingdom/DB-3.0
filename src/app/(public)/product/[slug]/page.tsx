import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetailsView } from "@/components/product/product-details-view";
import {
  getProductBySlug,
  getProductDetailsContentBySlug,
  getRelatedProducts,
} from "@/lib/services/product-service";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    return { title: "Product not found" };
  }

  return {
    title: product.name,
    description: product.shortDescription,
  };
}

export default async function ProductDetailsPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const [related, details] = await Promise.all([
    getRelatedProducts(product.slug, product.category, 12),
    getProductDetailsContentBySlug(product.slug),
  ]);

  return <ProductDetailsView product={product} related={related} details={details ?? undefined} />;
}
