export type CompareItem = {
  productId: string;
  slug: string;
  name: string;
  brand: string;
  category: string;
  imageUrl: string;
  unitPriceBase: number;
  oldPriceBase?: number;
  rating: number;
  reviewsCount: number;
  inStock: boolean;
  shortDescription: string;
  addedAt: string;
};
