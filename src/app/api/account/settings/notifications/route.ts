import { fail, ok } from "@/lib/api-response";
import { getCurrentSession } from "@/lib/auth/session";
import {
  getAccountNotificationSettings,
  updateAccountNotificationSettings,
} from "@/lib/services/account-settings-service";
import { accountNotificationSettingsUpdateSchema } from "@/lib/validators/account-settings";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) {
    return fail("Authentication required", 401, "UNAUTHENTICATED");
  }

  try {
    const settings = await getAccountNotificationSettings(session.sub);
    return ok(settings);
  } catch {
    return fail("Unable to fetch account settings", 500, "ACCOUNT_SETTINGS_FETCH_FAILED");
  }
}

export async function PATCH(request: Request) {
  const session = await getCurrentSession();
  if (!session) {
    return fail("Authentication required", 401, "UNAUTHENTICATED");
  }

  try {
    const payload = accountNotificationSettingsUpdateSchema.parse(await request.json());
    const updated = await updateAccountNotificationSettings(session.sub, payload.preferences);
    return ok(updated);
  } catch {
    return fail("Unable to update account settings", 400, "ACCOUNT_SETTINGS_UPDATE_FAILED");
  }
}
