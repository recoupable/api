import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { mapToPaymentMethodError } from "@/lib/billing/mapToPaymentMethodError";

const idSchema = z.string().uuid("id must be a valid UUID");

const bodySchema = z
  .object({
    returnUrl: z.string().min(1, "returnUrl is required").url("returnUrl must be a valid URL"),
  })
  .strict();

export type ValidatedCreatePortalParams = {
  accountId: string;
  returnUrl: string;
};

/**
 * Validates POST /api/accounts/{id}/portal: the `[id]` path param must be a
 * UUID the caller may access (own account or via organization membership),
 * and the body must be `{ returnUrl }`. Returns the target account id and
 * the return URL, or a `{ error }` NextResponse to forward.
 */
export async function validateCreatePortalParams(
  request: NextRequest,
  id: string,
): Promise<NextResponse | ValidatedCreatePortalParams> {
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json(
      { error: parsedId.error.issues[0].message },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const parsedBody = bodySchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: parsedBody.error.issues[0].message },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const auth = await validateAuthContext(request, { accountId: parsedId.data });
  if (auth instanceof NextResponse) {
    return mapToPaymentMethodError(auth);
  }

  return { accountId: parsedId.data, returnUrl: parsedBody.data.returnUrl };
}
