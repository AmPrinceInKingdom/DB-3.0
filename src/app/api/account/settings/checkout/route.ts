import { fail, ok } from "@/lib/api-response";
import { getCurrentSession } from "@/lib/auth/session";
import {
  getAccountCheckoutSettings,
  updateAccountCheckoutSettings,
} from "@/lib/services/account-settings-service";
import { accountCheckoutSettingsUpdateSchema } from "@/lib/validators/account-settings";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) {
    return fail("Authentication required", 401, "UNAUTHENTICATED");
  }

  try {
    const settings = await getAccountCheckoutSettings(session.sub);
    return ok(settings);
  } catch {
    return fail("Unable to fetch checkout settings", 500, "ACCOUNT_SETTINGS_FETCH_FAILED");
  }
}

export async function PATCH(request: Request) {
  const session = await getCurrentSession();
  if (!session) {
    return fail("Authentication required", 401, "UNAUTHENTICATED");
  }

  try {
    const payload = accountCheckoutSettingsUpdateSchema.parse(await request.json());
    const updated = await updateAccountCheckoutSettings(
      session.sub,
      payload,
    );
    return ok(updated);
  } catch {
    return fail("Unable to update checkout settings", 400, "ACCOUNT_SETTINGS_UPDATE_FAILED");
  }
}
