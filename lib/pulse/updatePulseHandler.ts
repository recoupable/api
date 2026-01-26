import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateUpdatePulseRequest } from "./validateUpdatePulseRequest";
import { upsertPulseAccount } from "@/lib/supabase/pulse_accounts/upsertPulseAccount";

/**
 * Handler for updating pulse status for an account.
 * Requires authentication via x-api-key header.
 *
 * Creates a new pulse_accounts record if one doesn't exist,
 * otherwise updates the existing record (upsert).
 *
 * Optional body parameter:
 * - account_id: For org API keys, target a specific account within the organization
 *
 * @param request - The request object.
 * @returns A NextResponse with the updated pulse account status.
 */
export async function updatePulseHandler(request: NextRequest): Promise<NextResponse> {
  const validated = await validateUpdatePulseRequest(request);
  if (validated instanceof NextResponse) {
    return validated;
  }
  const { accountId, active } = validated;

  const pulseAccount = await upsertPulseAccount({ account_id: accountId, active });

  if (!pulseAccount) {
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
      pulse: pulseAccount,
    },
    {
      status: 200,
      headers: getCorsHeaders(),
    },
  );
}
