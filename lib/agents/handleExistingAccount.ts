import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { storeVerificationCode } from "@/lib/agents/storeVerificationCode";

const GENERIC_MESSAGE =
  "If this is a new agent+ email, your API key is included. Otherwise, check your email for a verification code.";

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
    { account_id: accountId, api_key: null, message: GENERIC_MESSAGE },
    { status: 200, headers: getCorsHeaders() },
  );
}
