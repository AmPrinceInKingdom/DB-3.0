import { revalidateTag } from "next/cache";
import { AppError } from "@/lib/errors";
import { fail, ok } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/auth/admin-guard";
import { CHECKOUT_OPTIONS_CACHE_TAG } from "@/lib/services/checkout-service";
import {
  getAdminSettingsDashboard,
  updateAdminSettings,
} from "@/lib/services/admin-settings-service";
import { PUBLIC_SETTINGS_CACHE_TAG } from "@/lib/services/public-settings-service";
import { adminSettingsUpdateSchema } from "@/lib/validators/admin-settings";

export async function GET() {
  const auth = await requireAdminSession();
  if (!auth.allowed) return auth.response;

  try {
    const settings = await getAdminSettingsDashboard();
    return ok(settings);
  } catch {
    return fail("Unable to fetch admin settings", 500, "ADMIN_SETTINGS_FETCH_FAILED");
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.allowed) return auth.response;

  try {
    const payload = adminSettingsUpdateSchema.parse(await request.json());
    await updateAdminSettings(payload, auth.session.sub);
    revalidateTag(PUBLIC_SETTINGS_CACHE_TAG, "max");
    revalidateTag(CHECKOUT_OPTIONS_CACHE_TAG, "max");
    const updated = await getAdminSettingsDashboard();
    return ok(updated);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to update settings", 400, "ADMIN_SETTINGS_UPDATE_FAILED");
  }
}
