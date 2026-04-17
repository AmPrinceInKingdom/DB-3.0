import { AppError } from "@/lib/errors";
import { fail, ok } from "@/lib/api-response";
import { getCurrentSession } from "@/lib/auth/session";
import { getMySellerApplication, submitSellerApplication } from "@/lib/services/seller-service";
import { sellerApplicationSchema } from "@/lib/validators/seller";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) {
    return fail("Login required", 401, "UNAUTHORIZED");
  }

  try {
    const payload = await getMySellerApplication(session.sub);
    return ok(payload);
  } catch {
    return fail("Unable to fetch seller application", 500, "SELLER_APPLICATION_FETCH_FAILED");
  }
}

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session) {
    return fail("Login required", 401, "UNAUTHORIZED");
  }

  try {
    const payload = sellerApplicationSchema.parse(await request.json());
    const result = await submitSellerApplication(session.sub, payload);
    return ok(result);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to submit seller application", 400, "SELLER_APPLICATION_SUBMIT_FAILED");
  }
}
