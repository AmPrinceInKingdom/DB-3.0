import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken } from "@/lib/auth/jwt";
import { sessionCookieName } from "@/lib/auth/session";

const adminRoles = new Set(["ADMIN", "SUPER_ADMIN"]);
const sellerRoles = new Set(["SELLER", "ADMIN", "SUPER_ADMIN"]);
const protectedSellerPrefixes = [
  "/seller/dashboard",
  "/seller/products",
  "/seller/orders",
  "/seller/reports",
  "/seller/store",
  "/seller/payouts",
];

function redirectToLogin(request: NextRequest) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

async function getRoleFromRequest(request: NextRequest) {
  const token = request.cookies.get(sessionCookieName)?.value;
  if (!token) return null;
  try {
    const session = await verifySessionToken(token);
    return session.role;
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const role = await getRoleFromRequest(request);

  if (pathname.startsWith("/account")) {
    if (!role) return redirectToLogin(request);
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin")) {
    if (!role) return redirectToLogin(request);
    if (!adminRoles.has(role)) return NextResponse.redirect(new URL("/", request.url));
    return NextResponse.next();
  }

  if (protectedSellerPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    if (!role) return redirectToLogin(request);
    if (!sellerRoles.has(role)) return NextResponse.redirect(new URL("/", request.url));
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/account/:path*", "/admin/:path*", "/seller/:path*"],
};
