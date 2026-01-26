import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateGetPulseRequest } from "./validateGetPulseRequest";
import { selectPulseAccount } from "@/lib/supabase/pulse_accounts/selectPulseAccount";

/**
 * Handler for retrieving pulse status for an account.
 * Requires authentication via x-api-key header.
 *
 * Optional query parameter:
 * - account_id: For org API keys, target a specific account within the organization
 *
 * @param request - The request object.
 * @returns A NextResponse with the pulse account status.
 */
export async function getPulseHandler(request: NextRequest): Promise<NextResponse> {
  const validated = await validateGetPulseRequest(request);
  if (validated instanceof NextResponse) {
    return validated;
  }
  const { accountId } = validated;

  const pulseAccount = await selectPulseAccount(accountId);

  return NextResponse.json(
    {
      status: "success",
      pulse: pulseAccount ?? { id: null, account_id: accountId, active: false },
    },
    {
      status: 200,
      headers: getCorsHeaders(),
    },
  );
}
