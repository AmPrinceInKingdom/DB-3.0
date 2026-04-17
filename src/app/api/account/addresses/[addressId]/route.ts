import { fail, ok } from "@/lib/api-response";
import { getCurrentSession } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { deleteAccountAddress, updateAccountAddress } from "@/lib/services/account-address-service";
import { accountAddressUpdateSchema } from "@/lib/validators/account-addresses";

type RouteContext = {
  params: Promise<{
    addressId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getCurrentSession();
  if (!session) {
    return fail("Authentication required", 401, "UNAUTHENTICATED");
  }

  try {
    const { addressId } = await context.params;
    const payload = accountAddressUpdateSchema.parse(await request.json());
    const updated = await updateAccountAddress(session.sub, addressId, payload);
    return ok(updated);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to update address", 400, "ACCOUNT_ADDRESS_UPDATE_FAILED");
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getCurrentSession();
  if (!session) {
    return fail("Authentication required", 401, "UNAUTHENTICATED");
  }

  try {
    const { addressId } = await context.params;
    const deleted = await deleteAccountAddress(session.sub, addressId);
    return ok(deleted);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to delete address", 400, "ACCOUNT_ADDRESS_DELETE_FAILED");
  }
}
