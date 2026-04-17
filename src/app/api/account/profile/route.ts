import { fail, ok } from "@/lib/api-response";
import { getCurrentSession } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { getAccountProfile, updateAccountProfile } from "@/lib/services/account-profile-service";
import { accountProfileUpdateSchema } from "@/lib/validators/account-profile";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) {
    return fail("Authentication required", 401, "UNAUTHENTICATED");
  }

  try {
    const payload = await getAccountProfile(session.sub);
    return ok(payload);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to fetch profile", 500, "ACCOUNT_PROFILE_FETCH_FAILED");
  }
}

export async function PATCH(request: Request) {
  const session = await getCurrentSession();
  if (!session) {
    return fail("Authentication required", 401, "UNAUTHENTICATED");
  }

  try {
    const payload = accountProfileUpdateSchema.parse(await request.json());
    const updated = await updateAccountProfile(session.sub, payload);
    return ok(updated);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to update profile", 400, "ACCOUNT_PROFILE_UPDATE_FAILED");
  }
}
