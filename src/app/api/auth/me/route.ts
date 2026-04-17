import { fail, ok } from "@/lib/api-response";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) {
    return fail("Not authenticated", 401, "UNAUTHENTICATED");
  }

  const user = await db.user.findUnique({
    where: { id: session.sub },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      profile: {
        select: {
          firstName: true,
          lastName: true,
          preferredCurrency: true,
          preferredLanguage: true,
          themePreference: true,
        },
      },
    },
  });

  if (!user) {
    return fail("User not found", 404, "USER_NOT_FOUND");
  }

  return ok(user);
}
