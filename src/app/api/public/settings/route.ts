import { fail, ok } from "@/lib/api-response";
import { getPublicSiteSettings } from "@/lib/services/public-settings-service";

export async function GET() {
  try {
    const settings = await getPublicSiteSettings();
    return ok(settings);
  } catch {
    return fail("Unable to load public settings", 500, "PUBLIC_SETTINGS_FETCH_FAILED");
  }
}
