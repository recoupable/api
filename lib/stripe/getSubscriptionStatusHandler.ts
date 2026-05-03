import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getSubscriptionIsPro } from "@/lib/stripe/getSubscriptionIsPro";
import { validateSubscriptionStatusQuery } from "@/lib/stripe/validateSubscriptionStatusQuery";

export async function getSubscriptionStatusHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validateSubscriptionStatusQuery(request);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const isPro = await getSubscriptionIsPro(validated.accountId);
    return NextResponse.json({ isPro }, { status: 200, headers: getCorsHeaders() });
  } catch (error) {
    console.error("[getSubscriptionStatusHandler]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
