import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateGetPaymentMethodParams } from "@/lib/billing/validateGetPaymentMethodParams";
import { readAutoTopUpSettings } from "@/lib/billing/readAutoTopUpSettings";
import { buildAutoTopUpResponse } from "@/lib/billing/buildAutoTopUpResponse";
import { mapToPaymentMethodError } from "@/lib/billing/mapToPaymentMethodError";

/**
 * GET /api/accounts/[id]/auto-top-up
 *
 * Returns the account's opt-in auto top-up settings, or the documented
 * defaults (off, nothing set) when the account has no credits row yet.
 */
export async function getAutoTopUpHandler(
  request: NextRequest,
  params: Promise<{ id: string }>,
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const validated = await validateGetPaymentMethodParams(request, id);
    if (validated instanceof NextResponse) {
      return mapToPaymentMethodError(validated);
    }

    const row = await readAutoTopUpSettings(validated);
    return NextResponse.json(buildAutoTopUpResponse({ accountId: validated, row }), {
      status: 200,
      headers: getCorsHeaders(),
    });
  } catch (error) {
    console.error("[getAutoTopUpHandler]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
