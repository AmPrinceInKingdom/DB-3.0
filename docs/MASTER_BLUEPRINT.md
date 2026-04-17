# Deal Bazaar Master Blueprint

## 1. Full Project Overview
Deal Bazaar is a production-oriented multi-role e-commerce marketplace designed for customer-first shopping, strong admin control, and seller extensibility. The architecture is modular, typed, secure, and deployment-ready with clear separation of concerns between UI, domain services, auth, and data.

Platform priorities:
- Conversion-focused shopping UX
- Secure and auditable operations
- Clean data model for growth
- Multi-currency and i18n-ready architecture
- Admin-first control plane with seller expansion path

## 2. Recommended Final Tech Stack
- Frontend: Next.js App Router, React, TypeScript, Tailwind CSS
- Backend: Next.js Route Handlers + Service Layer
- DB: PostgreSQL
- ORM: Prisma
- Auth: JWT session cookies + secure password hashing (bcrypt)
- Validation: Zod + React Hook Form
- State: Zustand
- UI: Custom design system + Lucide icons
- Charts: Recharts
- File storage: Supabase Storage or Cloudinary
- Payments: Card gateway integration + bank transfer verification flow
- Deployment: Vercel (app), managed Postgres (Supabase/Neon/RDS), object storage CDN
- Monitoring: Sentry + OpenTelemetry + structured app logs

## 3. Full Feature List
- Public storefront with advanced product discovery
- Category/subcategory product architecture
- Product variants, attributes, media gallery, SEO fields
- Cart, wishlist, compare with guest + logged-in behavior
- Checkout with shipping, taxes, coupon support
- Card payment architecture and bank transfer proof verification
- Order lifecycle and status history tracking
- Reviews/ratings with moderation and verified purchase flag
- Notification center and admin alerts
- Admin dashboard and full management modules
- Seller onboarding and seller management architecture
- Multi-currency display + order-time currency snapshot
- Multi-language ready architecture (English/Sinhala)
- Analytics-ready domain model
- Security hardening, audit logs, and role-based guards

## 4. Full Role-Based Permission Plan
### Guest
- Browse/search/filter/sort products
- View product pages, offers, policies
- Add guest cart, compare
- Register/login

### Customer
- Account/profile/address management
- Cart/wishlist/compare persistence
- Checkout and order tracking
- Review after purchase
- Notification preferences

### Seller
- Seller profile and store setup
- Manage own products, pricing, stock
- Process own order items
- Payout visibility
- Seller analytics scope

### Admin
- Manage products/categories/subcategories
- Manage orders, payments, proof verification
- Manage users/sellers/reviews/coupons/banners/settings
- Inventory and reporting controls

### Super Admin
- Full admin access
- Manage admin accounts/privileges
- Platform-wide control and policy settings

## 5. Full Frontend Page List
### Public
- Home, Shop, Category, Subcategory, Product Detail
- Search Results, Offers, New Arrivals, Best Sellers, Featured Products
- About, Contact, FAQ, Privacy, Terms, Return Policy, Shipping Policy, Help Center
- 404, Maintenance

### Auth
- Login, Register, Forgot Password, Reset Password
- Email verification, OTP verification (optional/extendable)

### Customer
- Account dashboard, Profile, Address book
- Order history, Order detail, Wishlist, Compare, Cart
- Checkout, Payment selection, Bank proof upload, Order success
- Reviews management, Notifications, Recently viewed

### Admin
- Dashboard
- Products (list/create/edit)
- Categories/Subcategories
- Orders + detail
- Payments + verification
- Users/Admins/Sellers
- Coupons/Reviews/Inventory/Analytics
- Banner/Homepage CMS
- Settings/Reports

### Seller (planned architecture)
- Seller dashboard, products, add/edit product
- Seller orders, reports, store profile, payouts

## 6. Full Reusable Component List
- Layout: Navbar, Footer, Mobile Bottom Nav, Breadcrumbs, Sidebar
- Commerce: ProductCard, ProductGallery, VariantSelector, PriceBox, RatingStars
- Cart/Checkout: CartItem, CouponBox, ShippingSelector, OrderSummary, Timeline
- Data UI: Table, Pagination, Filters, SearchInput, EmptyState, Skeleton
- Feedback: Toast, Modal, Drawer, ConfirmDialog, StatusBadge
- Controls: Button, Input, Select, Textarea, Switch, Tabs
- Profile/Admin: Avatar, NotificationDropdown, UserMenu
- Global: Currency selector, Language selector, Theme toggle

## 7. Full Backend Module List
- `auth`: register/login/logout/session/forgot/reset/verification
- `rbac`: role policies + route guards
- `users`: profiles, addresses, preferences
- `catalog`: categories, subcategories, brands, products, variants, tags, media
- `search`: full-text, filters, sort handling
- `cart`: guest cart + user sync + totals
- `wishlist` and `compare`
- `checkout`: pricing pipeline, coupon, shipping, tax, order creation
- `payments`: card integration adapter + bank transfer proof workflow
- `orders`: state transitions + history + tracking
- `reviews`: create, moderate, aggregate
- `notifications`: user/admin notifications
- `analytics`: KPI aggregation endpoints
- `settings`: site/payment/shipping/localization configuration
- `audit`: admin action logging

## 8. Full Database Table List
- users
- user_profiles
- admins
- sellers
- seller_payout_accounts
- seller_payouts
- user_sessions
- email_verification_tokens
- password_reset_tokens
- otp_codes
- supported_currencies
- currency_rates
- categories
- subcategories
- brands
- product_tags
- products
- product_images
- product_videos
- product_attributes
- product_attribute_values
- product_variants
- product_variant_attribute_values
- product_tag_map
- carts
- cart_items
- wishlists
- wishlist_items
- compare_lists
- compare_items
- addresses
- shipping_methods
- coupons
- coupon_usages
- orders
- order_items
- order_status_history
- payments
- payment_proofs
- shipments
- reviews
- review_images
- notifications
- banners
- homepage_sections
- inventory_logs
- site_settings
- audit_logs
- newsletter_subscribers

## 9. Full PostgreSQL SQL Schema (One Runnable File)
- Location: `database/deal_bazaar.sql`
- Includes:
  - Extensions
  - Enums
  - Tables with constraints and defaults
  - Primary/foreign keys
  - Indexes
  - Trigger-based `updated_at`
  - Seed data (currencies, shipping methods, categories, sections, settings)

## 10. Prisma Schema Version
- Location: `prisma/schema.prisma`
- Includes:
  - Enum mapping to PostgreSQL enums
  - Full model mapping to snake_case tables
  - Typed relations for domain services
  - Indexes/uniques and mapped fields

## 11. Full Folder Structure
```text
src/
  app/
    (public)/...
    (auth)/...
    (account)/...
    (admin)/...
    api/
      auth/
  components/
    auth/
    home/
    layout/
    theme/
    ui/
  lib/
    auth/
    constants/
    i18n/
    services/
    validators/
    api-response.ts
    db.ts
    env.ts
    errors.ts
    rbac.ts
    utils.ts
  store/
  types/
database/
  deal_bazaar.sql
prisma/
  schema.prisma
public/
docs/
  MASTER_BLUEPRINT.md
```

## 12. Full Development Phase Plan
### Phase 1: Project Setup and Architecture
- Goal: Create production base, env validation, modular structure
- Build: app shell, core configs, DB client, service skeleton
- Key files: `src/lib/*`, root configs
- Backend: request/response pattern, error classes
- DB: schema draft + ORM setup
- UI: base layout container
- Testing: lint/type/build baseline
- Completion: app runs, schema compiles, structure stable

### Phase 2: Design System and Reusable UI
- Goal: Consistent premium design language
- Build: tokens, buttons/inputs/cards/badges, nav/footer
- Key files: `src/components/ui/*`, `globals.css`
- Backend: none
- DB: none
- UI: responsive public shell + dark/light theme
- Testing: responsive checks, accessibility basics
- Completion: reusable UI primitives ready

### Phase 3: Authentication and Role System
- Goal: Secure account entry + RBAC routing
- Build: register/login/logout/me endpoints, middleware guards
- Key files: `src/lib/auth/*`, `src/middleware.ts`, auth pages
- Backend: bcrypt + JWT cookies + zod validators
- DB: users/profile/session/token tables
- UI: login/register/forgot/reset pages
- Testing: happy path + invalid credentials + role guard checks
- Completion: customer/admin route protection active

### Phase 4: Catalog Core
- Goal: Product, category, variant, media CRUD foundations
- Build: admin product/category modules + services
- Backend: slug/sku validation, stock flags
- DB: catalog tables
- UI: product list/detail forms
- Testing: CRUD + validation + image URL integrity
- Completion: full catalog lifecycle works

### Phase 5: Storefront Discovery
- Goal: Search/filter/sort conversion-focused listing
- Build: shop/search/category/subcategory pages
- Backend: filter query builder + full-text search
- DB: indexes and search vector usage
- UI: filter drawer + pagination
- Testing: query correctness and performance
- Completion: product discovery is production-usable

### Phase 6: Cart, Wishlist, Compare
- Goal: Persistent shopping intent systems
- Build: add/remove/update sync logic
- Backend: guest/user merges and totals
- DB: carts/wishlist/compare tables
- UI: cart and saved lists
- Testing: cross-device cart behavior
- Completion: stable persistence for all intents

### Phase 7: Checkout and Order Creation
- Goal: Robust checkout pipeline
- Build: address, shipping, tax, coupon, order creation
- Backend: transactional order logic
- DB: orders/order_items/history
- UI: checkout wizard + summary
- Testing: pricing correctness and edge cases
- Completion: order placement reliability

### Phase 8: Payments and Verification
- Goal: payment-ready architecture
- Build: card adapter contract + bank proof review flow
- Backend: payment states + proof moderation
- DB: payments/payment_proofs
- UI: payment selection/proof upload/admin verify
- Testing: payment state transitions
- Completion: verified paid/unpaid handling

### Phase 9: Customer Account Suite
- Goal: post-purchase self-service
- Build: orders, profile, addresses, notifications, reviews
- Backend: account endpoints
- DB: profile/address/review/notification tables
- UI: account dashboard modules
- Testing: account journey
- Completion: customer panel complete

### Phase 10: Admin Control Plane
- Goal: full admin operations
- Build: dashboard modules + management tables + actions
- Backend: admin services and bulk actions
- DB: audit logs and reporting queries
- UI: admin dashboard and modules
- Testing: role-restricted flows
- Completion: admin can run marketplace end-to-end

### Phase 11: Promotions and CMS
- Goal: growth tooling
- Build: coupons, banners, homepage sections
- Backend: validation and lifecycle controls
- DB: coupon/banners/homepage settings
- UI: campaign setup and preview
- Testing: discount logic and expiry rules
- Completion: marketing operations complete

### Phase 12: Multi-Currency and Localization
- Goal: global-ready storefront
- Build: currency conversion service, locale dictionary scaffolding
- Backend: order currency snapshot pipeline
- DB: supported_currencies + currency_rates
- UI: selectors and locale formatting
- Testing: display/order consistency
- Completion: stable multi-currency/i18n-ready behavior

### Phase 13: Security Hardening
- Goal: production security posture
- Build: rate limit, stricter upload policy, secure headers, audit trails
- Backend: abuse controls + security logging
- DB: audit inspection support
- UI: auth/session UX safeguards
- Testing: auth abuse and permission bypass tests
- Completion: security baseline achieved

### Phase 14: Testing and QA Stabilization
- Goal: release confidence
- Build: integration and e2e critical flow coverage
- Backend: deterministic fixtures
- DB: test seed strategy
- UI: regression matrix
- Testing: CI pipelines
- Completion: release-grade defect rate

### Phase 15: Deployment and Production Readiness
- Goal: go-live readiness
- Build: env setup, migrations, observability, backups
- Backend: health checks + telemetry
- DB: migration/rollback plan
- UI: SEO and performance pass
- Testing: staging sign-off
- Completion: production launch checklist complete

### Phase 16: Seller Module Completion
- Goal: enable marketplace vendor operations
- Build: seller dashboards/products/orders/payout analytics
- Backend: seller-scoped authorization
- DB: seller financial and reporting queries
- UI: seller portal
- Testing: seller isolation and payout correctness
- Completion: seller module fully active

## 13. Full Admin Panel Plan
- Dashboard KPIs: revenue, orders, users, products, pending proofs
- Modules: Products, Catalog, Orders, Payments, Users, Sellers, Coupons, Reviews, Inventory, Banners, Settings, Reports
- Operational features: filters, search, sort, pagination, bulk updates
- Security: RBAC, audit trail, sensitive action confirmation
- Export strategy: CSV/Excel endpoints with async job architecture

## 14. Full Customer Panel Plan
- Dashboard with order and notification snapshots
- Profile and password management
- Address book management
- Orders with status timeline and detail view
- Wishlist, compare, and recently viewed
- Review submission after verified purchase
- Notification center and preference controls

## 15. Full Seller Module Architecture
- Seller onboarding + approval flow
- Seller profile and storefront settings
- Seller-scoped catalog management
- Seller order-item fulfillment workflow
- Commission and payout ledger architecture
- Seller analytics for sales/performance trends

## 16. Full Multi-Currency Plan
- Store base prices in base currency (`LKR` default)
- Maintain `supported_currencies` and daily `currency_rates`
- Store selected display currency in profile/local store
- Convert display-time prices only
- Snapshot currency and exchange rate into each order at placement
- Never recompute historical order totals from latest rates

## 17. Full Security Plan
- Password hashing (bcrypt, strong policy)
- HttpOnly secure JWT cookies with expiration
- Route-level RBAC middleware
- Input validation with Zod on all write endpoints
- ORM parameterization to prevent injection
- File upload type/size checks for payment proofs
- Security headers and safe defaults
- Audit logging for admin-sensitive actions
- Rate limiting plan (IP + user + endpoint)

## 18. Full SEO Plan
- Semantic pages and clean slugs
- Metadata per page/product (title/description/open graph)
- Canonical URL patterns
- Robots and sitemap routes
- Product structured data architecture (JSON-LD)
- Optimized image loading and alt text standards

## 19. Full Performance Optimization Plan
- Server-side rendering where conversion-critical
- Query-layer indexing and pagination
- Image optimization and responsive sizes
- Lazy-loading for non-critical content
- Cache strategy for catalog and settings
- Bundle splitting by route and role area
- Lighthouse-driven perf budgets for mobile

## 20. Full Testing Checklist
- Auth: register/login/logout/session expiry/role redirects
- Catalog: product/category CRUD and validation
- Discovery: search/filter/sort correctness
- Cart flow: guest + merge + totals + coupon
- Checkout: shipping/tax/order totals
- Payments: card status and bank proof verification flow
- Orders: status transitions and history
- Admin access control and forbidden path tests
- UI responsiveness across mobile/tablet/desktop
- Currency switching and order snapshot consistency
- Security checks: malformed input, auth bypass attempts, upload abuse

## 21. Full Deployment Checklist
- Vercel project + environment variables
- Managed PostgreSQL provisioned
- Run SQL/bootstrap or Prisma migration strategy
- Prisma generate + build in CI
- Storage bucket/CDN configuration
- Domain + SSL + DNS records
- Monitoring (Sentry + logs + uptime)
- Backup policy and restore drill
- Rollback strategy for schema and app deploys
- Production smoke tests post-release
