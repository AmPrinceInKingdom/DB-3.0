export type WishlistItem = {
  productId: string;
  slug: string;
  name: string;
  brand: string;
  imageUrl: string;
  unitPriceBase: number;
  oldPriceBase?: number;
  rating?: number;
  inStock: boolean;
  addedAt: string;
};
