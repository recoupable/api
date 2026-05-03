import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { mapToSubscriptionSessionError } from "@/lib/stripe/mapToSubscriptionSessionError";

const querySchema = z.object({
  accountId: z.string().uuid("accountId must be a valid UUID"),
});

export type ValidatedGetSubscriptionStatusRequest = {
  accountId: string;
};

export async function validateGetSubscriptionStatusRequest(
  request: NextRequest,
): Promise<NextResponse | ValidatedGetSubscriptionStatusRequest> {
  const raw = request.nextUrl.searchParams.get("accountId");
  if (raw === null || raw === "") {
    return NextResponse.json(
      { error: "accountId is required" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const parsed = querySchema.safeParse({ accountId: raw });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json({ error: first.message }, { status: 400, headers: getCorsHeaders() });
  }

  const authContext = await validateAuthContext(request, { accountId: parsed.data.accountId });
  if (authContext instanceof NextResponse) {
    return mapToSubscriptionSessionError(authContext);
  }

  return { accountId: authContext.accountId };
}
