import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getApiKeyAccountId } from "@/lib/auth/getApiKeyAccountId";
import { validateOverrideAccountId } from "@/lib/accounts/validateOverrideAccountId";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { validateUpdatePulseBody, type UpdatePulseBody } from "./validateUpdatePulseBody";
import { selectPulseAccount } from "@/lib/supabase/pulse_accounts/selectPulseAccount";
import { insertPulseAccount } from "@/lib/supabase/pulse_accounts/insertPulseAccount";
import { updatePulseAccount } from "@/lib/supabase/pulse_accounts/updatePulseAccount";

/**
 * Handler for updating pulse status for an account.
 * Requires authentication via x-api-key header.
 *
 * Creates a new pulse_accounts record if one doesn't exist,
 * otherwise updates the existing record.
 *
 * Optional body parameter:
 * - account_id: For org API keys, target a specific account within the organization
 *
 * @param request - The request object.
 * @returns A NextResponse with the updated pulse account status.
 */
export async function updatePulseHandler(request: NextRequest): Promise<NextResponse> {
  const accountIdOrError = await getApiKeyAccountId(request);
  if (accountIdOrError instanceof NextResponse) {
    return accountIdOrError;
  }
  let accountId = accountIdOrError;

  const body = await safeParseJson(request);
  const validated = validateUpdatePulseBody(body);
  if (validated instanceof NextResponse) {
    return validated;
  }
  const { active, account_id: targetAccountId } = validated as UpdatePulseBody;

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

  const existingPulseAccount = await selectPulseAccount(accountId);

  let pulseAccount;
  if (existingPulseAccount) {
    pulseAccount = await updatePulseAccount(accountId, { active });
  } else {
    pulseAccount = await insertPulseAccount({ account_id: accountId, active });
  }

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
      pulse: {
        id: pulseAccount.id,
        account_id: pulseAccount.account_id,
        active: pulseAccount.active,
      },
    },
    {
      status: 200,
      headers: getCorsHeaders(),
    },
  );
}
