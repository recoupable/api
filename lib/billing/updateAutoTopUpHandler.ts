import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateGetPaymentMethodParams } from "@/lib/billing/validateGetPaymentMethodParams";
import { validateUpdateAutoTopUpBody } from "@/lib/billing/validateUpdateAutoTopUpBody";
import { accountHasPaymentMethod } from "@/lib/stripe/accountHasPaymentMethod";
import { updateAutoTopUp } from "@/lib/supabase/credits_usage/updateAutoTopUp";
import { initializeAccountCredits } from "@/lib/credits/initializeAccountCredits";
import { usdToCredits } from "@/lib/credits/usdToCredits";
import { buildAutoTopUpResponse } from "@/lib/billing/buildAutoTopUpResponse";
import { mapToPaymentMethodError } from "@/lib/billing/mapToPaymentMethodError";

const NO_CARD_MESSAGE = "Add a payment method before turning on auto top-up";

/**
 * PUT /api/accounts/[id]/auto-top-up
 *
 * Saves the three user-chosen settings. Turning auto top-up on requires a
 * card on file; turning it off keeps the amounts so they can be re-enabled
 * without retyping. The charge itself never happens here.
 */
export async function updateAutoTopUpHandler(
  request: NextRequest,
  params: Promise<{ id: string }>,
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const validated = await validateGetPaymentMethodParams(request, id);
    if (validated instanceof NextResponse) {
      return mapToPaymentMethodError(validated);
    }

    const body = await validateUpdateAutoTopUpBody(request);
    if (body instanceof NextResponse) {
      return body;
    }

    if (body.enabled && !(await accountHasPaymentMethod(validated))) {
      return NextResponse.json(
        { error: NO_CARD_MESSAGE },
        { status: 400, headers: getCorsHeaders() },
      );
    }

    const settings = {
      accountId: validated,
      enabled: body.enabled,
      amountCredits: usdToCredits(body.amountCents / 100),
      thresholdCredits: usdToCredits(body.thresholdCents / 100),
    };
    let row = await updateAutoTopUp(settings);
    if (!row) {
      // Organizations have no credits_usage row until something creates one;
      // give the account its plan-derived row, then save the settings on it.
      // A concurrent request may win the insert; retry the update either way.
      await initializeAccountCredits(validated);
      row = await updateAutoTopUp(settings);
    }
    if (!row) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404, headers: getCorsHeaders() },
      );
    }

    return NextResponse.json(buildAutoTopUpResponse({ accountId: validated, row }), {
      status: 200,
      headers: getCorsHeaders(),
    });
  } catch (error) {
    console.error("[updateAutoTopUpHandler]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
