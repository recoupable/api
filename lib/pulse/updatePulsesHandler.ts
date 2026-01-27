import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateUpdatePulsesRequest } from "./validateUpdatePulsesRequest";
import { upsertPulseAccount } from "@/lib/supabase/pulse_accounts/upsertPulseAccount";

/**
 * Handler for updating pulse status for an account.
 * Requires authentication via x-api-key header or Authorization bearer token.
 *
 * Creates a new pulse_accounts record if one doesn't exist,
 * otherwise updates the existing record (upsert).
 *
 * Returns an array containing the upserted pulse record.
 *
 * @param request - The request object.
 * @returns A NextResponse with array of pulse account statuses.
 */
export async function updatePulsesHandler(request: NextRequest): Promise<NextResponse> {
  const validated = await validateUpdatePulsesRequest(request);
  if (validated instanceof NextResponse) {
    return validated;
  }
  const { accountId, active } = validated;

  // Update the pulse account - returns array
  const pulses = await upsertPulseAccount({ account_id: accountId, active });

  if (!pulses || pulses.length === 0) {
    return NextResponse.json(
      {
        status: "error",
        error: "Failed to update pulse status",
      },
      {
        status: 500,
        headers: getCorsHeaders(),
      },
    );
  }

  return NextResponse.json(
    {
      status: "success",
      pulses,
    },
    {
      status: 200,
      headers: getCorsHeaders(),
    },
  );
}
