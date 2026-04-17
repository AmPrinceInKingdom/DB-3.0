export type Product = {
  id: string;
  name: string;
  slug: string;
  category: string;
  brand: string;
  imageUrl: string;
  price: number;
  oldPrice?: number;
  rating: number;
  reviewsCount: number;
  inStock: boolean;
  isFeatured?: boolean;
  isBestSeller?: boolean;
  isNewArrival?: boolean;
  shortDescription: string;
};

export type ProductSpecification = {
  label: string;
  value: string;
};

export type ProductReview = {
  id: string;
  author: string;
  date: string;
  rating: number;
  title: string;
  body: string;
  isVerifiedPurchase?: boolean;
  image?: string;
};

export type ProductDetailsContent = {
  description: string;
  galleryImages: string[];
  specifications: ProductSpecification[];
  reviews: ProductReview[];
  storeName?: string;
  variants: ProductDetailsVariant[];
};

export type ProductDetailsVariant = {
  id: string;
  sku: string;
  name: string | null;
  options: Record<string, string>;
  price: number;
  oldPrice: number | null;
  stockQuantity: number;
  imageUrl: string | null;
  isDefault: boolean;
};
