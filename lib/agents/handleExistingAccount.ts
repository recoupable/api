import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { AGENT_SIGNUP_GENERIC_MESSAGE } from "@/lib/const";
import { storeVerificationCode } from "@/lib/agents/storeVerificationCode";

/**
 * Existing-account path — email already has an account, so we never issue a
 * key directly. Always sends a verification code and returns `api_key: null`.
 *
 * @param accountId - The existing account ID
 * @param email - The email that matched an existing account
 * @returns NextResponse with `api_key: null`
 */
export async function handleExistingAccount(
  accountId: string,
  email: string,
): Promise<NextResponse> {
  await storeVerificationCode(email);

  return NextResponse.json(
    { account_id: accountId, api_key: null, message: AGENT_SIGNUP_GENERIC_MESSAGE },
    { status: 200, headers: getCorsHeaders() },
  );
}
