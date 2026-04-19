export type NavItem = {
  label: string;
  href: string;
};

export const publicNavItems: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "Shop", href: "/shop" },
  { label: "Compare", href: "/compare" },
  { label: "Deals", href: "/offers" },
  { label: "New Arrivals", href: "/new-arrivals" },
  { label: "Best Sellers", href: "/best-sellers" },
  { label: "Contact", href: "/contact" },
];

export const accountNavItems: NavItem[] = [
  { label: "Dashboard", href: "/account" },
  { label: "Profile", href: "/account/profile" },
  { label: "Orders", href: "/account/orders" },
  { label: "Recently Viewed", href: "/account/recently-viewed" },
  { label: "My Reviews", href: "/account/reviews" },
  { label: "Wishlist", href: "/wishlist" },
  { label: "Addresses", href: "/account/addresses" },
  { label: "Notifications", href: "/account/notifications" },
  { label: "Settings", href: "/account/settings" },
];

export const adminNavItems: NavItem[] = [
  { label: "Dashboard", href: "/admin" },
  { label: "Banners", href: "/admin/banners" },
  { label: "Products", href: "/admin/products" },
  { label: "Categories", href: "/admin/categories" },
  { label: "Brands", href: "/admin/brands" },
  { label: "Orders", href: "/admin/orders" },
  { label: "Payments", href: "/admin/payments" },
  { label: "Payment Gateway", href: "/admin/payment-gateway" },
  { label: "Auth Diagnostics", href: "/admin/auth-diagnostics" },
  { label: "DB Export", href: "/admin/db-export" },
  { label: "Payouts", href: "/admin/payouts" },
  { label: "Users", href: "/admin/users" },
  { label: "Sellers", href: "/admin/sellers" },
  { label: "Coupons", href: "/admin/coupons" },
  { label: "Reviews", href: "/admin/reviews" },
  { label: "Inventory", href: "/admin/inventory" },
  { label: "Notifications", href: "/admin/notifications" },
  { label: "Analytics", href: "/admin/analytics" },
  { label: "Settings", href: "/admin/settings" },
];

export const sellerNavItems: NavItem[] = [
  { label: "Seller Home", href: "/seller" },
  { label: "Apply", href: "/seller/apply" },
  { label: "Dashboard", href: "/seller/dashboard" },
  { label: "Products", href: "/seller/products" },
  { label: "Orders", href: "/seller/orders" },
  { label: "Payouts", href: "/seller/payouts" },
  { label: "Reports", href: "/seller/reports" },
  { label: "Store Profile", href: "/seller/store" },
];
