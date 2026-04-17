import { fail, ok } from "@/lib/api-response";
import { getCurrentSession } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { createAccountAddress, listAccountAddresses } from "@/lib/services/account-address-service";
import { accountAddressCreateSchema } from "@/lib/validators/account-addresses";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) {
    return fail("Authentication required", 401, "UNAUTHENTICATED");
  }

  try {
    const addresses = await listAccountAddresses(session.sub);
    return ok({ addresses });
  } catch {
    return fail("Unable to fetch addresses", 500, "ACCOUNT_ADDRESSES_FETCH_FAILED");
  }
}

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session) {
    return fail("Authentication required", 401, "UNAUTHENTICATED");
  }

  try {
    const payload = accountAddressCreateSchema.parse(await request.json());
    const address = await createAccountAddress(session.sub, payload);
    return ok(address, 201);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to create address", 400, "ACCOUNT_ADDRESS_CREATE_FAILED");
  }
}
