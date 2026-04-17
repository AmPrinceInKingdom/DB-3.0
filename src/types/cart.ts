import type { CurrencyCode } from "@/lib/constants/currency";

export type CartLineItem = {
  lineId: string;
  productId: string;
  slug: string;
  name: string;
  brand: string;
  imageUrl: string;
  quantity: number;
  unitPriceBase: number;
  variantId?: string | null;
  variantLabel?: string | null;
};

export type SavedCartItem = CartLineItem & {
  oldPriceBase?: number;
  inStock?: boolean;
  savedAt: string;
};

export type CheckoutAddressInput = {
  firstName: string;
  lastName: string;
  company?: string | null;
  phone?: string | null;
  line1: string;
  line2?: string | null;
  city: string;
  state?: string | null;
  postalCode?: string | null;
  countryCode: string;
};

export type CheckoutPayload = {
  customerEmail: string;
  customerPhone?: string | null;
  notes?: string | null;
  couponCode?: string | null;
  billingAddressId?: string | null;
  shippingAddressId?: string | null;
  shippingMethodCode: string;
  paymentMethod: "CARD" | "BANK_TRANSFER";
  currencyCode: CurrencyCode;
  items: CartLineItem[];
  billingAddress: CheckoutAddressInput;
  shippingAddress: CheckoutAddressInput;
};
