import { fail, ok } from "@/lib/api-response";
import { getCheckoutOptions } from "@/lib/services/checkout-service";

export async function GET() {
  try {
    const options = await getCheckoutOptions();
    return ok(options);
  } catch {
    return fail("Unable to load checkout options", 500, "CHECKOUT_OPTIONS_FAILED");
  }
}
