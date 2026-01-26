import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getApiKeyAccountId } from "@/lib/auth/getApiKeyAccountId";
import { validateOverrideAccountId } from "@/lib/accounts/validateOverrideAccountId";
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
  const accountIdOrError = await getApiKeyAccountId(request);
  if (accountIdOrError instanceof NextResponse) {
    return accountIdOrError;
  }
  let accountId = accountIdOrError;

  const { searchParams } = new URL(request.url);
  const targetAccountId = searchParams.get("account_id");

  if (targetAccountId) {
    const apiKey = request.headers.get("x-api-key");
    const overrideResult = await validateOverrideAccountId({
      apiKey,
      targetAccountId,
    });
    if (overrideResult instanceof NextResponse) {
      return overrideResult;
    }
    accountId = overrideResult.accountId;
  }

  const pulseAccount = await selectPulseAccount(accountId);

  return NextResponse.json(
    {
      status: "success",
      pulse: {
        id: pulseAccount?.id ?? null,
        account_id: accountId,
        active: pulseAccount?.active ?? false,
      },
    },
    {
      status: 200,
      headers: getCorsHeaders(),
    },
  );
}
