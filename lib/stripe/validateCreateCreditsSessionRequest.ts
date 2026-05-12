import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { createCreditsSessionBodySchema } from "@/lib/stripe/createCreditsSessionSchemas";
import { mapToCreditsSessionError } from "@/lib/stripe/mapToCreditsSessionError";

export type ValidatedCreateCreditsSessionRequest = {
  accountId: string;
  successUrl: string;
  credits: number;
};

export async function validateCreateCreditsSessionRequest(
  request: NextRequest,
): Promise<NextResponse | ValidatedCreateCreditsSessionRequest> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const parsed = createCreditsSessionBodySchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json({ error: first.message }, { status: 400, headers: getCorsHeaders() });
  }

  const authContext = await validateAuthContext(request, { accountId: parsed.data.accountId });
  if (authContext instanceof NextResponse) {
    return mapToCreditsSessionError(authContext);
  }

  return {
    accountId: authContext.accountId,
    successUrl: parsed.data.successUrl,
    credits: parsed.data.credits,
  };
}
