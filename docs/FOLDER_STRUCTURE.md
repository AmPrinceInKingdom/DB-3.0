# Deal Bazaar Folder Structure

```text
deal-bazaar/
+- database/
¦  +- deal_bazaar.sql
+- docs/
¦  +- MASTER_BLUEPRINT.md
¦  +- FOLDER_STRUCTURE.md
+- prisma/
¦  +- schema.prisma
+- public/
+- src/
¦  +- app/
¦  ¦  +- (public)/
¦  ¦  ¦  +- layout.tsx
¦  ¦  ¦  +- page.tsx
¦  ¦  ¦  +- shop/page.tsx
¦  ¦  ¦  +- product/[slug]/page.tsx
¦  ¦  ¦  +- offers/page.tsx
¦  ¦  ¦  +- new-arrivals/page.tsx
¦  ¦  ¦  +- best-sellers/page.tsx
¦  ¦  ¦  +- featured-products/page.tsx
¦  ¦  ¦  +- about/page.tsx
¦  ¦  ¦  +- contact/page.tsx
¦  ¦  ¦  +- faq/page.tsx
¦  ¦  ¦  +- privacy/page.tsx
¦  ¦  ¦  +- terms/page.tsx
¦  ¦  ¦  +- return-policy/page.tsx
¦  ¦  ¦  +- shipping-policy/page.tsx
¦  ¦  ¦  +- help-center/page.tsx
¦  ¦  ¦  +- partners/page.tsx
¦  ¦  ¦  +- maintenance/page.tsx
¦  ¦  ¦  +- seller/page.tsx
¦  ¦  ¦  +- seller/apply/page.tsx
¦  ¦  ¦  +- wishlist/page.tsx
¦  ¦  ¦  +- cart/page.tsx
¦  ¦  +- (auth)/
¦  ¦  ¦  +- layout.tsx
¦  ¦  ¦  +- login/page.tsx
¦  ¦  ¦  +- register/page.tsx
¦  ¦  ¦  +- forgot-password/page.tsx
¦  ¦  ¦  +- reset-password/page.tsx
¦  ¦  +- (account)/
¦  ¦  ¦  +- layout.tsx
¦  ¦  ¦  +- account/page.tsx
¦  ¦  +- (admin)/
¦  ¦  ¦  +- layout.tsx
¦  ¦  ¦  +- admin/page.tsx
¦  ¦  +- api/
¦  ¦  ¦  +- auth/
¦  ¦  ¦     +- login/route.ts
¦  ¦  ¦     +- logout/route.ts
¦  ¦  ¦     +- me/route.ts
¦  ¦  ¦     +- register/route.ts
¦  ¦  +- layout.tsx
¦  ¦  +- not-found.tsx
¦  ¦  +- globals.css
¦  +- components/
¦  ¦  +- auth/
¦  ¦  +- home/
¦  ¦  +- layout/
¦  ¦  +- theme/
¦  ¦  +- ui/
¦  +- lib/
¦  ¦  +- auth/
¦  ¦  +- constants/
¦  ¦  +- i18n/
¦  ¦  +- services/
¦  ¦  +- validators/
¦  ¦  +- api-response.ts
¦  ¦  +- db.ts
¦  ¦  +- env.ts
¦  ¦  +- errors.ts
¦  ¦  +- rbac.ts
¦  ¦  +- utils.ts
¦  +- store/
¦  +- types/
¦  +- proxy.ts
+- .env.example
+- next.config.ts
+- package.json
+- tsconfig.json
```
