import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateGetPulsesRequest } from "./validateGetPulsesRequest";
import { selectPulseAccounts } from "@/lib/supabase/pulse_accounts/selectPulseAccounts";

/**
 * Handler for retrieving pulse statuses for accounts.
 * Requires authentication via x-api-key header or Authorization bearer token.
 *
 * Returns array with pulse for the authenticated account (if exists).
 * For Recoup admin key: Returns array of ALL pulse records.
 *
 * Optional query parameters:
 * - account_id: Filter to a specific account (validated against org membership)
 * - active: Filter by active status (true/false). If undefined, returns all.
 *
 * @param request - The request object.
 * @returns A NextResponse with array of pulse account statuses.
 */
export async function getPulsesHandler(request: NextRequest): Promise<NextResponse> {
  const validated = await validateGetPulsesRequest(request);
  if (validated instanceof NextResponse) {
    return validated;
  }

  // Pass validated params directly to selectPulseAccounts
  const pulses = await selectPulseAccounts(validated);

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
